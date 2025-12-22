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

interface PageProps {
  params: Promise<{ slug: string; websiteId: string; competitorId: string }>;
}

interface SerpComparison {
  query: string;
  productName: string;
  productId: string;
  ourPosition: number;
  theirPosition: number;
  weAreBetter: boolean;
}

async function getCompetitorSerpComparisons(
  competitorId: string,
  websiteId: string
): Promise<SerpComparison[]> {
  // Get competitor URL
  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
    select: { url: true },
  });

  if (!competitor) return [];

  const competitorDomain = new URL(competitor.url).hostname.replace(/^www\./, "");

  // Get all products for this website with their latest SERP results
  const products = await prisma.product.findMany({
    where: { websiteId, isActive: true },
    select: {
      id: true,
      name: true,
      serpResults: {
        where: { position: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 10, // Get more results per product to find all queries
        select: { query: true, position: true, rawDataBlobUrl: true },
      },
    },
  });

  const comparisons: SerpComparison[] = [];
  const seenQueries = new Set<string>();

  for (const product of products) {
    for (const serpResult of product.serpResults) {
      // Skip if we've already processed this query
      if (seenQueries.has(serpResult.query)) continue;
      
      if (!serpResult.rawDataBlobUrl || serpResult.position === null) continue;

      try {
        const response = await fetch(serpResult.rawDataBlobUrl);
        if (!response.ok) continue;

        const serpData = await response.json();
        if (!serpData.results || !Array.isArray(serpData.results)) continue;

        // Find competitor in results
        const competitorResult = serpData.results.find((r: { domain: string; position: number }) => {
          const resultDomain = r.domain.replace(/^www\./, "");
          return resultDomain === competitorDomain || resultDomain.endsWith(`.${competitorDomain}`);
        });

        if (competitorResult) {
          seenQueries.add(serpResult.query);
          comparisons.push({
            query: serpResult.query,
            productName: product.name,
            productId: product.id,
            ourPosition: serpResult.position,
            theirPosition: competitorResult.position,
            weAreBetter: serpResult.position < competitorResult.position,
          });
        }
      } catch {
        // Skip invalid blobs
      }
    }
  }

  // Sort: queries where we are worse first, then by position difference
  return comparisons.sort((a, b) => {
    if (a.weAreBetter !== b.weAreBetter) {
      return a.weAreBetter ? 1 : -1; // Show where we lose first
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
  });

  if (!competitor) notFound();

  // Get SERP comparisons
  const comparisons = await getCompetitorSerpComparisons(competitorId, websiteId);

  // Calculate summary
  const better = comparisons.filter((c) => c.weAreBetter).length;
  const worse = comparisons.filter((c) => !c.weAreBetter && c.ourPosition !== c.theirPosition).length;
  const netScore = better - worse;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href={`/dashboard/o/${slug}/w/${websiteId}/competitors`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour aux concurrents
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">{competitor.name}</h1>
        <div className="flex items-center gap-4 text-muted-foreground">
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
      <div className="grid gap-4 md:grid-cols-4 mb-8">
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
                <div className="col-span-5">Requête</div>
                <div className="col-span-3">Produit</div>
                <div className="col-span-1 text-center">Nous</div>
                <div className="col-span-1 text-center">Eux</div>
                <div className="col-span-2 text-center">Statut</div>
              </div>

              {/* Rows */}
              {comparisons.map((comparison, index) => {
                const diff = comparison.theirPosition - comparison.ourPosition;
                const isWinning = diff > 0;
                const isLosing = diff < 0;

                return (
                  <div
                    key={`${comparison.query}-${index}`}
                    className={`grid grid-cols-12 gap-2 px-3 py-3 rounded-lg ${
                      isWinning ? "bg-green-50 dark:bg-green-950/30" : 
                      isLosing ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
                    }`}
                  >
                    <div className="col-span-5 font-medium truncate" title={comparison.query}>
                      {comparison.query}
                    </div>
                    <div className="col-span-3">
                      <Link
                        href={`/dashboard/o/${slug}/w/${websiteId}/products/${comparison.productId}`}
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {comparison.productName}
                      </Link>
                    </div>
                    <div className="col-span-1 text-center font-bold">
                      #{comparison.ourPosition}
                    </div>
                    <div className="col-span-1 text-center font-bold">
                      #{comparison.theirPosition}
                    </div>
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      {isWinning && (
                        <>
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-green-600 font-medium">+{diff}</span>
                        </>
                      )}
                      {isLosing && (
                        <>
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          <span className="text-red-500 font-medium">{diff}</span>
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
  );
}
