import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Search, Zap, Mountain } from "lucide-react";
import { SerpChart } from "./_components/SerpChart";
import { CompetitorsList } from "./_components/CompetitorsList";
import { SuggestionsList } from "./_components/SuggestionsList";
import { MetaComparisonBlock } from "./_components/MetaComparisonBlock";
import { AISuggestionsBlock } from "./_components/AISuggestionsBlock";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string; queryId: string }>;
}

export default async function QueryDetailPage({ params }: PageProps) {
  const { slug, websiteId, queryId } = await params;
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

  if (!membership) {
    notFound();
  }

  // Get search query with SERP history
  const searchQuery = await prisma.searchQuery.findFirst({
    where: {
      id: queryId,
      website: {
        id: websiteId,
        organizationId: membership.organizationId,
      },
    },
    include: {
      website: true,
      serpResults: {
        orderBy: { createdAt: "desc" },
        take: 2,
      },
      _count: {
        select: {
          serpResults: true,
          aiSuggestions: true,
        },
      },
    },
  });

  if (!searchQuery) {
    notFound();
  }

  // Calculate position trend
  const latestPosition = searchQuery.serpResults[0]?.position;
  const previousPosition = searchQuery.serpResults[1]?.position;
  const hasPosition = latestPosition !== null && latestPosition !== undefined && latestPosition > 0;
  let trend: "up" | "down" | "stable" | "absent" | null = null;
  
  if (!hasPosition && searchQuery.serpResults.length > 0) {
    trend = "absent";
  } else if (hasPosition && previousPosition !== null && previousPosition !== undefined && previousPosition > 0) {
    if (latestPosition < previousPosition) trend = "up";
    else if (latestPosition > previousPosition) trend = "down";
    else trend = "stable";
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/o/${slug}/w/${websiteId}/queries`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux requêtes
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{searchQuery.title}</h1>
              {!searchQuery.isActive && (
                <span className="text-sm font-normal text-muted-foreground bg-muted px-3 py-1 rounded">
                  Inactif
                </span>
              )}
              {searchQuery.competitionLevel === "HIGH" ? (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-orange-600 bg-orange-100 px-3 py-1 rounded">
                  <Zap className="w-4 h-4" />
                  Forte concurrence
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm font-normal text-green-600 bg-green-100 px-3 py-1 rounded">
                  <Mountain className="w-4 h-4" />
                  Longue traîne
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{searchQuery.description}</p>
          </div>
          {searchQuery.serpResults.length > 0 && (
            <div className="flex items-center gap-3 ml-8">
              {trend === "up" && <TrendingUp className="w-6 h-6 text-green-500" />}
              {trend === "down" && <TrendingDown className="w-6 h-6 text-red-500" />}
              {trend === "stable" && <Minus className="w-6 h-6 text-gray-400" />}
              <div className="text-right">
                {hasPosition ? (
                  <div className="text-4xl font-bold">#{latestPosition}</div>
                ) : (
                  <div className="text-4xl font-bold text-orange-500">Absent</div>
                )}
                <div className="text-sm text-muted-foreground">Position actuelle</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search Query Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Requête de recherche
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-lg font-medium bg-primary/10 text-primary">
                  {searchQuery.query}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* SERP Chart - Client Component */}
          <SerpChart
            orgSlug={slug}
            websiteId={websiteId}
            queryId={queryId}
          />

          {/* Competitors - Client Component */}
          <CompetitorsList
            orgSlug={slug}
            websiteId={websiteId}
            queryId={queryId}
          />

          {/* Meta Comparison - Client Component */}
          <MetaComparisonBlock
            orgSlug={slug}
            websiteId={websiteId}
            queryId={queryId}
          />

          {/* AI Suggestions - Client Component */}
          <AISuggestionsBlock
            orgSlug={slug}
            websiteId={websiteId}
            queryId={queryId}
          />

          {/* Suggestions - Client Component */}
          <SuggestionsList
            orgSlug={slug}
            websiteId={websiteId}
            queryId={queryId}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Query Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Confiance IA</div>
                <div className="text-2xl font-bold">{Math.round(searchQuery.confidence * 100)}%</div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${searchQuery.confidence * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Analyses SERP</div>
                <div className="text-2xl font-bold">{searchQuery._count.serpResults}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Suggestions IA</div>
                <div className="text-2xl font-bold">{searchQuery._count.aiSuggestions}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Site web</div>
                <div className="text-sm">{searchQuery.website.name}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Niveau de concurrence</div>
                <div className="text-sm">
                  {searchQuery.competitionLevel === "HIGH" ? "Forte (requête générique)" : "Faible (longue traîne)"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Créé le</div>
                <div className="text-sm">{new Date(searchQuery.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Dernière mise à jour</div>
                <div className="text-sm">{new Date(searchQuery.updatedAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
