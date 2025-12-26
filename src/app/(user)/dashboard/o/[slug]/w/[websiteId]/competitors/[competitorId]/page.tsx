import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Calendar,
} from "lucide-react";
import { CompetitorSitemapColumn } from "../../_components/CompetitorSitemapColumn";

// Disable caching for this page
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string; competitorId: string }>;
}

interface SerpComparison {
  query: string;
  queryId: string;
  ourPosition: number;
  theirPosition: number;
  weAreBetter: boolean;
}

/**
 * Get SERP comparisons between our search queries and a competitor.
 * Uses SerpResult data directly from the database (not from blob storage).
 */
async function getCompetitorSerpComparisons(
  competitorId: string,
  websiteId: string
): Promise<SerpComparison[]> {
  // Get our latest SERP results for each search query
  const searchQueries = await prisma.searchQuery.findMany({
    where: { websiteId, isActive: true },
    select: {
      id: true,
      query: true,
      serpResults: {
        orderBy: { createdAt: "desc" },
        take: 50, // Get more results to have multiple queries per search query
        select: { query: true, position: true, createdAt: true },
      },
    },
  });

  // Build a map of our positions: query -> { position, queryId }
  const ourPositions = new Map<string, { position: number | null; queryId: string }>();
  for (const searchQuery of searchQueries) {
    for (const result of searchQuery.serpResults) {
      const queryLower = result.query.toLowerCase();
      // Keep the first (most recent) result for each query
      if (!ourPositions.has(queryLower)) {
        ourPositions.set(queryLower, {
          position: result.position,
          queryId: searchQuery.id,
        });
      }
    }
  }

  // Get competitor's SERP results
  const competitorResults = await prisma.serpResult.findMany({
    where: { competitorId },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true, createdAt: true },
  });

  // Build a map of competitor positions: query -> position
  const theirPositions = new Map<string, number | null>();
  for (const result of competitorResults) {
    const queryLower = result.query.toLowerCase();
    if (!theirPositions.has(queryLower)) {
      theirPositions.set(queryLower, result.position);
    }
  }

  // Build comparisons for queries where we have data for both or at least one
  const comparisons: SerpComparison[] = [];
  const processedQueries = new Set<string>();

  // First, process queries where we have our own data
  for (const [query, ourData] of ourPositions.entries()) {
    if (processedQueries.has(query)) continue;
    processedQueries.add(query);

    const theirPos = theirPositions.get(query);
    const ourPos = ourData.position;

    const weArePresent = ourPos !== null && ourPos > 0;
    const theyArePresent = theirPos !== null && theirPos !== undefined && theirPos > 0;

    // Only include if at least one is present
    if (weArePresent || theyArePresent) {
      let weAreBetter: boolean;
      if (weArePresent && !theyArePresent) {
        weAreBetter = true;
      } else if (!weArePresent && theyArePresent) {
        weAreBetter = false;
      } else {
        weAreBetter = ourPos! < theirPos!;
      }

      comparisons.push({
        query: query,
        queryId: ourData.queryId,
        ourPosition: ourPos ?? 0,
        theirPosition: theirPos ?? 0,
        weAreBetter,
      });
    }
  }

  // Sort: queries where we are worse first, then by position difference
  return comparisons.sort((a, b) => {
    if (a.weAreBetter !== b.weAreBetter) {
      return a.weAreBetter ? 1 : -1;
    }
    return Math.abs(a.theirPosition - a.ourPosition) - Math.abs(b.theirPosition - b.ourPosition);
  });
}

export default async function CompetitorDetailPage({ params }: PageProps) {
  const { slug, websiteId, competitorId } = await params;
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

  // Fetch website
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organization.id,
    },
  });

  if (!website) notFound();

  // Fetch competitor
  const competitor = await prisma.competitor.findFirst({
    where: {
      id: competitorId,
      websiteId,
    },
    include: {
      serpResults: {
        where: { url: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  if (!competitor) notFound();

  // Get the most recent competitor page URL from SERP results
  const competitorPageUrl = competitor.serpResults[0]?.url || null;

  // Get SERP comparisons
  const comparisons = await getCompetitorSerpComparisons(competitorId, websiteId);

  // Calculate summary
  const better = comparisons.filter((c) => c.weAreBetter).length;
  const worse = comparisons.filter((c) => !c.weAreBetter && c.ourPosition !== c.theirPosition).length;
  const netScore = better - worse;

  return (
    <div className="container mx-auto p-6">
      <Link
        href={`/dashboard/o/${slug}/w/${websiteId}/competitors`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour aux concurrents
      </Link>

      <div className="flex gap-6">
        {/* Left side - Details and comparisons */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold mb-2">{competitor.name}</h1>
            <div className="flex flex-col gap-2 text-muted-foreground">
              <a
                href={competitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
              >
                <Globe className="w-4 h-4" />
                {competitor.url}
                <ExternalLink className="w-3 h-3" />
              </a>
              {competitorPageUrl && (
                <a
                  href={competitorPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm ml-5"
                >
                  Page : {competitorPageUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="flex items-center gap-1 text-sm">
                <Calendar className="w-4 h-4" />
                Suivi depuis le {new Date(competitor.createdAt).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {competitor.description && (
              <p className="mt-2 text-muted-foreground">{competitor.description}</p>
            )}
          </div>

          {/* Score summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className={`text-3xl font-bold ${
                    netScore > 0 ? "text-green-600" : netScore < 0 ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {netScore > 0 ? "+" : ""}{netScore}
                  </p>
                  <p className="text-sm text-muted-foreground">Score net</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">{better}</p>
                  <p className="text-sm text-muted-foreground">Vous êtes devant</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{worse}</p>
                  <p className="text-sm text-muted-foreground">Ils sont devant</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{comparisons.length}</p>
                  <p className="text-sm text-muted-foreground">Requêtes en commun</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparisons table */}
          <Card>
            <CardHeader>
              <CardTitle>Comparaison par requête</CardTitle>
              <CardDescription>
                Positions SERP comparées avec {competitor.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparisons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="mb-2">Aucune donnée de comparaison disponible.</p>
                  <p className="text-sm">
                    Les comparaisons apparaîtront après les analyses SERP de vos produits.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase border-b">
                    <div className="col-span-6">Requête</div>
                    <div className="col-span-2 text-center">Nous</div>
                    <div className="col-span-2 text-center">Eux</div>
                    <div className="col-span-2 text-center">Statut</div>
                  </div>

                  {/* Rows */}
                  {comparisons.map((comparison, index) => {
                    const isWinning = comparison.weAreBetter;
                    const isLosing = !comparison.weAreBetter && (comparison.ourPosition !== comparison.theirPosition);
                    
                    // Calculate display diff
                    let diffDisplay: string;
                    if (comparison.ourPosition === 0 && comparison.theirPosition > 0) {
                      diffDisplay = "Absent";
                    } else if (comparison.ourPosition > 0 && comparison.theirPosition === 0) {
                      diffDisplay = "Eux absents";
                    } else {
                      const diff = comparison.theirPosition - comparison.ourPosition;
                      diffDisplay = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "=";
                    }

                    return (
                      <div
                        key={`${comparison.query}-${index}`}
                        className={`grid grid-cols-12 gap-2 px-3 py-3 rounded-lg ${
                          isWinning ? "bg-green-50 dark:bg-green-950/30" : 
                          isLosing ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
                        }`}
                      >
                        <div className="col-span-6">
                          <Link
                            href={`/dashboard/o/${slug}/w/${websiteId}/queries/${comparison.queryId}`}
                            className="font-medium hover:underline text-blue-600 truncate block"
                            title={comparison.query}
                          >
                            {comparison.query}
                          </Link>
                        </div>
                        <div className={`col-span-2 text-center font-bold ${comparison.ourPosition === 0 ? 'text-orange-500' : ''}`}>
                          {comparison.ourPosition > 0 ? `#${comparison.ourPosition}` : 'Absent'}
                        </div>
                        <div className={`col-span-2 text-center font-bold ${comparison.theirPosition === 0 ? 'text-orange-500' : ''}`}>
                          {comparison.theirPosition > 0 ? `#${comparison.theirPosition}` : 'Absent'}
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1">
                          {isWinning && (
                            <>
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-green-600 font-medium text-xs">{diffDisplay}</span>
                            </>
                          )}
                          {isLosing && (
                            <>
                              <TrendingDown className="w-4 h-4 text-red-500" />
                              <span className="text-red-500 font-medium text-xs">{diffDisplay}</span>
                            </>
                          )}
                          {!isWinning && !isLosing && (
                            <>
                              <Minus className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">=</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right side - Sitemap */}
        <div className="w-100 shrink-0">
          <CompetitorSitemapColumn
            orgSlug={slug}
            websiteId={websiteId}
            competitorId={competitorId}
            competitorName={competitor.name}
            competitorUrl={competitor.url}
          />
        </div>
      </div>
    </div>
  );
}
