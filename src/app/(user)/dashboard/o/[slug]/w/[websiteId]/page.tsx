"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyzeButton } from "./_components/AnalyzeButton";
import { CompetitorScore } from "./_components/CompetitorScore";
import {
  ArrowLeft,
  BarChart3,
  Users2,
  FileText,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

interface SerpResult {
  position: number | null;
  createdAt: Date;
}

interface Product {
  id: string;
  name: string;
  keywords: string[];
  serpResults: SerpResult[];
  _count: {
    aiSuggestions: number;
  };
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  serpResults: SerpResult[];
}

interface AIReport {
  id: string;
  type: string;
  title: string;
  createdAt: Date;
}

interface Website {
  id: string;
  name: string;
  url: string;
  status: string;
  products: Product[];
  competitors: Competitor[];
  aiReports: AIReport[];
}

interface WebsiteData {
  website: Website;
}

// Get trend for a product (comparing last 2 SERP results)
const getTrend = (serpResults: { position: number | null }[]) => {
  if (serpResults.length < 2) return null;
  const current = serpResults[0]?.position;
  const previous = serpResults[1]?.position;
  if (current === null || previous === null) return null;
  return previous - current; // Positive = improvement (lower position is better)
};

const getTrendIcon = (trend: number | null) => {
  if (trend === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
  if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

export default function WebsitePage({ params }: PageProps) {
  const { slug, websiteId } = use(params);
  const router = useRouter();
  const [data, setData] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/organizations/${slug}/websites/${websiteId}/dashboard`);
        if (response.ok) {
          const websiteData = await response.json();
          setData(websiteData);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load website data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, websiteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg text-muted-foreground">Site web introuvable</p>
        <Link href={`/dashboard/o/${slug}`}>
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l&apos;organisation
          </Button>
        </Link>
      </div>
    );
  }

  const { website } = data;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Link
        href={`/dashboard/o/${slug}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour à l&apos;organisation
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{website.name}</h1>
          <a
            href={website.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {website.url}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={website.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Voir le site
            </a>
          </Button>
          <AnalyzeButton
            orgSlug={slug}
            websiteId={websiteId}
            isAnalyzing={website.status === "analyzing"}
          />
        </div>
      </div>

      {/* Status banner for pending/analyzing websites */}
      {website.status !== "active" && (
        <Card className="mb-8 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-center gap-4 py-4">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            <div>
              <p className="font-medium">Analyse en cours</p>
              <p className="text-sm text-muted-foreground">
                Nous analysons votre site pour identifier vos produits et services. Cela peut prendre quelques minutes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produits/Services</CardDescription>
            <CardTitle className="text-3xl">{website.products.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Concurrents suivis</CardDescription>
            <CardTitle className="text-3xl">{website.competitors.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rapports IA</CardDescription>
            <CardTitle className="text-3xl">{website.aiReports.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suggestions en attente</CardDescription>
            <CardTitle className="text-3xl">
              {website.products.reduce((acc, p) => acc + p._count.aiSuggestions, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Products section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Produits & Services
            </h2>
            <Link href={`/dashboard/o/${slug}/w/${websiteId}/products`}>
              <Button variant="ghost" size="sm">Voir tout</Button>
            </Link>
          </div>

          {website.products.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                {website.status === "active"
                  ? "Aucun produit identifié. Relancez l'analyse ou ajoutez-en manuellement."
                  : "Les produits seront identifiés automatiquement après l'analyse."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {website.products.slice(0, 5).map((product) => {
                const latestPosition = product.serpResults[0]?.position;
                const trend = getTrend(product.serpResults);

                return (
                  <Link key={product.id} href={`/dashboard/o/${slug}/w/${websiteId}/products/${product.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.keywords.slice(0, 3).join(", ")}
                              {product.keywords.length > 3 && ` +${product.keywords.length - 3}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            {product._count.aiSuggestions > 0 && (
                              <div className="flex items-center gap-1 text-amber-500">
                                <Lightbulb className="w-4 h-4" />
                                <span className="text-sm">{product._count.aiSuggestions}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {getTrendIcon(trend)}
                              <span className="text-lg font-semibold">
                                {latestPosition !== null && latestPosition !== undefined && latestPosition > 0
                                  ? `#${latestPosition}`
                                  : product.serpResults.length > 0
                                    ? <span className="text-orange-500">Absent</span>
                                    : "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Competitors section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users2 className="w-5 h-5" />
              Concurrents
            </h2>
            <Link href={`/dashboard/o/${slug}/w/${websiteId}/competitors`}>
              <Button variant="ghost" size="sm">Voir tout</Button>
            </Link>
          </div>

          {website.competitors.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                Les concurrents seront détectés automatiquement lors de l&apos;analyse SERP.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {website.competitors.slice(0, 5).map((competitor) => (
                  <Link key={competitor.id} href={`/dashboard/o/${slug}/w/${websiteId}/competitors/${competitor.id}`}>
                    <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{competitor.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {competitor.url}
                            </p>
                          </div>
                          <CompetitorScore
                            orgSlug={slug}
                            websiteId={websiteId}
                            competitorId={competitor.id}
                            competitorUrl={competitor.url}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Reports section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Rapports IA
          </h2>
          <Link href={`/dashboard/o/${slug}/w/${websiteId}/reports`}>
            <Button variant="ghost" size="sm">Voir tout</Button>
          </Link>
        </div>

        {website.aiReports.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              Les rapports seront générés après l&apos;analyse initiale.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {website.aiReports.map((report) => (
              <Link key={report.id} href={`/dashboard/o/${slug}/w/${websiteId}/reports/${report.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardDescription>
                      {report.type === "initial_analysis"
                        ? "Analyse initiale"
                        : report.type === "periodic_recap"
                        ? "Récap périodique"
                        : "Analyse concurrentielle"}
                    </CardDescription>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
