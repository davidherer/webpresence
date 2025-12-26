import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, TrendingUp, TrendingDown, Minus, Zap, Mountain, Tag, FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

export default async function QueriesPage({ params }: PageProps) {
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

  if (!membership) {
    notFound();
  }

  // Get website with search queries
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organizationId,
    },
    include: {
      searchQueries: {
        orderBy: { createdAt: "desc" },
        include: {
          serpResults: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: {
              competitorPageExtractions: true,
            },
          },
        },
      },
    },
  });

  if (!website) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/o/${slug}/w/${websiteId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au site
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Requêtes de recherche</h1>
            <p className="text-muted-foreground">{website.name}</p>
          </div>
        </div>
      </div>

      {/* Search queries list */}
      {website.searchQueries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune requête identifiée</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              L&apos;analyse initiale n&apos;a pas encore identifié de requêtes de recherche. Relancez l&apos;analyse depuis la page
              du site.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {website.searchQueries.map((searchQuery) => {
            const latestSerp = searchQuery.serpResults[0];
            const previousPosition = latestSerp?.position ? latestSerp.position + 5 : null; // Mock for trend

            return (
              <Card key={searchQuery.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
                          <Search className="w-4 h-4 mr-2" />
                          {searchQuery.query}
                        </span>
                        {!searchQuery.isActive && (
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                            Inactif
                          </span>
                        )}
                        {searchQuery.competitionLevel === "HIGH" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">
                            <Zap className="w-3 h-3" />
                            Forte concurrence
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600 bg-green-100 px-2 py-1 rounded">
                            <Mountain className="w-3 h-3" />
                            Longue traîne
                          </span>
                        )}
                      </CardTitle>
                      {searchQuery.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          {searchQuery.tags.map((tag) => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <CardDescription className="mt-2">{searchQuery.description}</CardDescription>
                    </div>
                    {latestSerp && (
                      <div className="flex items-center gap-2 ml-4">
                        {previousPosition && latestSerp.position !== null && latestSerp.position > 0 && latestSerp.position < previousPosition ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : previousPosition && latestSerp.position !== null && latestSerp.position > 0 && latestSerp.position > previousPosition ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-400" />
                        )}
                        {latestSerp.position !== null && latestSerp.position > 0 ? (
                          <span className="text-2xl font-bold">#{latestSerp.position}</span>
                        ) : (
                          <span className="text-2xl font-bold text-orange-500">Absent</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Confiance: {Math.round(searchQuery.confidence * 100)}%
                        </div>
                        {searchQuery._count.competitorPageExtractions > 0 && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <FileText className="w-4 h-4" />
                            {searchQuery._count.competitorPageExtractions} extraction{searchQuery._count.competitorPageExtractions > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/o/${slug}/w/${websiteId}/queries/${searchQuery.id}`}>
                          Voir les détails
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
