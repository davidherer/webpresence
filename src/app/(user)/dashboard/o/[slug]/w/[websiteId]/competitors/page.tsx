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

// Compute competitor score based on SERP comparisons
async function computeCompetitorScore(
  competitorId: string,
  websiteId: string
): Promise<{ better: number; worse: number; total: number }> {
  // Get all products for this website with their latest SERP results
  const products = await prisma.product.findMany({
    where: { websiteId, isActive: true },
    select: {
      id: true,
      serpResults: {
        where: { position: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { query: true, position: true, rawDataBlobUrl: true },
      },
    },
  });

  // Get competitor URL
  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
    select: { url: true },
  });

  if (!competitor) return { better: 0, worse: 0, total: 0 };

  const competitorDomain = new URL(competitor.url).hostname.replace(/^www\./, "");
  
  let better = 0; // Times we rank better than competitor
  let worse = 0;  // Times competitor ranks better than us
  let total = 0;  // Total comparisons

  // For each product, check the SERP blob for competitor position
  for (const product of products) {
    for (const serpResult of product.serpResults) {
      if (!serpResult.rawDataBlobUrl || serpResult.position === null) continue;

      try {
        const response = await fetch(serpResult.rawDataBlobUrl);
        if (!response.ok) continue;

        const serpData = await response.json();
        if (!serpData.results || !Array.isArray(serpData.results)) continue;

        // Find competitor in results
        const competitorResult = serpData.results.find((r: { domain: string }) => {
          const resultDomain = r.domain.replace(/^www\./, "");
          return resultDomain === competitorDomain || resultDomain.endsWith(`.${competitorDomain}`);
        });

        if (competitorResult) {
          total++;
          const ourPosition = serpResult.position;
          const theirPosition = competitorResult.position;
          
          if (ourPosition < theirPosition) {
            better++; // Lower position = better ranking
          } else if (ourPosition > theirPosition) {
            worse++;
          }
        }
      } catch {
        // Skip invalid blobs
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
