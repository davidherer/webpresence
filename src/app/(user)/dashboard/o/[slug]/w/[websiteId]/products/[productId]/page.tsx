import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { SerpChart } from "./_components/SerpChart";
import { CompetitorsList } from "./_components/CompetitorsList";
import { SuggestionsList } from "./_components/SuggestionsList";
import { KeywordsManager } from "./_components/KeywordsManager";
import { MetaComparisonBlock } from "./_components/MetaComparisonBlock";

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

  // Get product with SERP history
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
          {/* Keywords - Client Component for editing */}
          <KeywordsManager
            orgSlug={slug}
            websiteId={websiteId}
            productId={productId}
            initialKeywords={product.keywords}
          />

          {/* SERP Chart - Client Component */}
          <SerpChart
            orgSlug={slug}
            websiteId={websiteId}
            productId={productId}
          />

          {/* Competitors - Client Component */}
          <CompetitorsList
            orgSlug={slug}
            websiteId={websiteId}
            productId={productId}
          />

          {/* Meta Comparison - Client Component */}
          <MetaComparisonBlock
            orgSlug={slug}
            websiteId={websiteId}
            productId={productId}
          />

          {/* Suggestions - Client Component */}
          <SuggestionsList
            orgSlug={slug}
            websiteId={websiteId}
            productId={productId}
          />
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
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${product.confidence * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Analyses SERP</div>
                <div className="text-2xl font-bold">{product._count.serpResults}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Suggestions IA</div>
                <div className="text-2xl font-bold">{product._count.aiSuggestions}</div>
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
