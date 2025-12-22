import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Users2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

/**
 * Compute competitor score based on SERP comparisons.
 * Uses SerpResult data directly from the database (not from blob storage).
 */
async function computeCompetitorScore(
  competitorId: string,
  websiteId: string
): Promise<{ better: number; worse: number; total: number }> {
  // Get our latest SERP positions (from search queries)
  const ourResults = await prisma.serpResult.findMany({
    where: {
      searchQuery: { websiteId, isActive: true },
      searchQueryId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true },
  });

  // Build a map of our latest position per query
  const ourPositions = new Map<string, number | null>();
  for (const result of ourResults) {
    const queryLower = result.query.toLowerCase();
    if (!ourPositions.has(queryLower)) {
      ourPositions.set(queryLower, result.position);
    }
  }

  // Get competitor's latest SERP positions
  const competitorResults = await prisma.serpResult.findMany({
    where: { competitorId },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true },
  });

  // Build a map of competitor's latest position per query
  const theirPositions = new Map<string, number | null>();
  for (const result of competitorResults) {
    const queryLower = result.query.toLowerCase();
    if (!theirPositions.has(queryLower)) {
      theirPositions.set(queryLower, result.position);
    }
  }

  // Compare positions on common queries
  let better = 0;
  let worse = 0;
  let total = 0;

  // Get all unique queries from both sets
  const allQueries = new Set([...ourPositions.keys(), ...theirPositions.keys()]);

  for (const query of allQueries) {
    const ourPos = ourPositions.get(query);
    const theirPos = theirPositions.get(query);

    const weArePresent = ourPos !== null && ourPos !== undefined && ourPos > 0;
    const theyArePresent = theirPos !== null && theirPos !== undefined && theirPos > 0;

    // Only count if at least one is present
    if (weArePresent || theyArePresent) {
      total++;

      if (weArePresent && !theyArePresent) {
        better++;
      } else if (!weArePresent && theyArePresent) {
        worse++;
      } else if (weArePresent && theyArePresent) {
        if (ourPos! < theirPos!) {
          better++;
        } else if (ourPos! > theirPos!) {
          worse++;
        }
        // Equal positions don't count as better or worse
      }
    }
  }

  return { better, worse, total };
}

export default async function CompetitorsListPage({ params }: PageProps) {
  const { slug, websiteId } = await params;
  const user = await getUserSession();
  if (!user) redirect("/");

  // Check access
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      organization: { slug },
    },
    include: { organization: true },
  });

  if (!membership) notFound();

  // Fetch website with competitors
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organization.id,
    },
    include: {
      competitors: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!website) notFound();

  // Compute scores for each competitor
  const competitorsWithScores = await Promise.all(
    website.competitors.map(async (competitor) => {
      const score = await computeCompetitorScore(competitor.id, websiteId);
      return { ...competitor, score };
    })
  );

  const ScoreDisplay = ({ score }: { score: { better: number; worse: number; total: number } }) => {
    if (score.total === 0) {
      return <span className="text-muted-foreground">-</span>;
    }

    const netScore = score.better - score.worse;
    const isPositive = netScore > 0;
    const isNegative = netScore < 0;

    return (
      <div className="flex items-center gap-2">
        <span className={`font-semibold text-lg ${
          isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"
        }`}>
          {netScore > 0 ? "+" : ""}{netScore}
        </span>
        {isPositive && <TrendingUp className="w-4 h-4 text-green-600" />}
        {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
        {!isPositive && !isNegative && <Minus className="w-4 h-4 text-muted-foreground" />}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href={`/dashboard/o/${slug}/w/${websiteId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour au site
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users2 className="w-6 h-6" />
          Concurrents
        </h1>
      </div>

      {website.competitors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun concurrent identifié pour le moment.
            </p>
            <p className="text-sm text-muted-foreground">
              Les concurrents seront détectés automatiquement lors de l&apos;analyse SERP de vos produits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {competitorsWithScores.map((competitor) => (
            <Link
              key={competitor.id}
              href={`/dashboard/o/${slug}/w/${websiteId}/competitors/${competitor.id}`}
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{competitor.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="truncate">{competitor.url}</span>
                        <a
                          href={competitor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <ScoreDisplay score={competitor.score} />
                      {competitor.score.total > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {competitor.score.better}↑ / {competitor.score.worse}↓ sur {competitor.score.total} requêtes
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Légende du score</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-green-600 font-semibold">+N</span>
            <span>Vous êtes devant le concurrent sur N requêtes de plus</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-red-500 font-semibold">-N</span>
            <span>Le concurrent est devant vous sur N requêtes de plus</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
