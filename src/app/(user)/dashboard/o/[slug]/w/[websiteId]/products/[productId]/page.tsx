import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink, Calendar } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug, websiteId, productId } = await params;
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

  // Get product with SERP history and suggestions
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      website: {
        id: websiteId,
        organizationId: membership.organizationId,
      },
    },
    include: {
      website: true,
      serpResults: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      aiSuggestions: {
        orderBy: { createdAt: "desc" },
        where: { status: { not: "dismissed" } },
      },
    },
  });

  if (!product) {
    notFound();
  }

  // Calculate position trend
  const latestPosition = product.serpResults[0]?.position;
  const previousPosition = product.serpResults[1]?.position;
  let trend: "up" | "down" | "stable" | null = null;
  if (latestPosition && previousPosition) {
    if (latestPosition < previousPosition) trend = "up";
    else if (latestPosition > previousPosition) trend = "down";
    else trend = "stable";
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/o/${slug}/w/${websiteId}/products`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux produits
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{product.name}</h1>
              {!product.isActive && (
                <span className="text-sm font-normal text-muted-foreground bg-muted px-3 py-1 rounded">
                  Inactif
                </span>
              )}
            </div>
            <p className="text-muted-foreground">{product.description}</p>
          </div>
          {latestPosition && (
            <div className="flex items-center gap-3 ml-8">
              {trend === "up" && <TrendingUp className="w-6 h-6 text-green-500" />}
              {trend === "down" && <TrendingDown className="w-6 h-6 text-red-500" />}
              {trend === "stable" && <Minus className="w-6 h-6 text-gray-400" />}
              <div className="text-right">
                <div className="text-4xl font-bold">#{latestPosition}</div>
                <div className="text-sm text-muted-foreground">Position actuelle</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Mots-clés surveillés</CardTitle>
              <CardDescription>
                Les mots-clés principaux pour ce produit utilisés dans l'analyse SERP
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {product.keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SERP History */}
          <Card>
            <CardHeader>
              <CardTitle>Historique de positionnement</CardTitle>
              <CardDescription>Les 10 dernières vérifications de position dans les moteurs de recherche</CardDescription>
            </CardHeader>
            <CardContent>
              {product.serpResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Aucune donnée de positionnement disponible. L'analyse SERP n'a pas encore été effectuée.
                </p>
              ) : (
                <div className="space-y-3">
                  {product.serpResults.map((result) => (
                    <div key={result.id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <span className="text-2xl font-bold">#{result.position}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        <div className="text-sm text-muted-foreground truncate">{result.query}</div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                        <Calendar className="w-4 h-4" />
                        {new Date(result.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                      {result.url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={result.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          {product.aiSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Suggestions d'amélioration</CardTitle>
                <CardDescription>Recommandations générées par l'IA pour améliorer le positionnement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {product.aiSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            suggestion.priority === "high"
                              ? "bg-red-100 text-red-700"
                              : suggestion.priority === "medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {suggestion.priority === "high"
                            ? "Haute"
                            : suggestion.priority === "medium"
                              ? "Moyenne"
                              : "Basse"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.content}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-muted-foreground">
                          Type: {suggestion.type === "content" ? "Contenu" : suggestion.type === "keyword" ? "Mot-clé" : suggestion.type === "technical" ? "Technique" : "Backlink"}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {suggestion.status === "pending" ? "En attente" : "Acceptée"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Product Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Confiance IA</div>
                <div className="text-2xl font-bold">{Math.round(product.confidence * 100)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${product.confidence * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Site web</div>
                <div className="text-sm">{product.website.name}</div>
              </div>

              {product.sourceUrl && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Page source</div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir la page
                    </a>
                  </Button>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Créé le</div>
                <div className="text-sm">{new Date(product.createdAt).toLocaleDateString("fr-FR")}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Dernière mise à jour</div>
                <div className="text-sm">{new Date(product.updatedAt).toLocaleDateString("fr-FR")}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
