"use client";

import { useEffect, useState, useMemo } from "react";
import { use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyzeButton } from "./_components/AnalyzeButton";
import { CompetitorScore } from "./_components/CompetitorScore";
import { OnboardingBanner } from "./_components/OnboardingBanner";
import { GenerateQueriesDialog } from "./_components/GenerateQueriesDialog";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Search,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

interface SerpResult {
  position: number | null;
  createdAt: Date;
}

interface SearchQuery {
  id: string;
  query: string;
  description: string | null;
  competitionLevel: "HIGH" | "LOW";
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
  searchQueries: SearchQuery[];
  competitors: Competitor[];
  aiReports: AIReport[];
}

interface WebsiteData {
  website: Website;
}

// Get trend for a search query (comparing last 2 SERP results)
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
  const [data, setData] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  
  // Filtres
  const [queryFilter, setQueryFilter] = useState("");
  const [competitorFilter, setCompetitorFilter] = useState("");
  const [reportFilter, setReportFilter] = useState("");

  // Reload data function
  const reloadData = async () => {
    try {
      const response = await fetch(`/api/organizations/${slug}/websites/${websiteId}/dashboard`);
      if (response.ok) {
        const websiteData = await response.json();
        setData(websiteData);
      }
    } catch (err) {
      console.error("Failed to reload data:", err);
    }
  };

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

  // Filtrage des données
  const filteredQueries = useMemo(() => {
    if (!data) return [];
    return data.website.searchQueries.filter(q =>
      q.query.toLowerCase().includes(queryFilter.toLowerCase()) ||
      (q.description?.toLowerCase() || "").includes(queryFilter.toLowerCase())
    );
  }, [data, queryFilter]);

  const filteredCompetitors = useMemo(() => {
    if (!data) return [];
    return data.website.competitors.filter(c =>
      c.name.toLowerCase().includes(competitorFilter.toLowerCase()) ||
      c.url.toLowerCase().includes(competitorFilter.toLowerCase())
    );
  }, [data, competitorFilter]);

  const filteredReports = useMemo(() => {
    if (!data) return [];
    return data.website.aiReports.filter(r =>
      r.title.toLowerCase().includes(reportFilter.toLowerCase()) ||
      r.type.toLowerCase().includes(reportFilter.toLowerCase())
    );
  }, [data, reportFilter]);

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
    <div className="w-full min-h-screen p-4">
      {/* Header compact */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/o/${slug}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <a
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {website.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="w-4 h-4 mr-1" />
            Générer
          </Button>
          <AnalyzeButton
            orgSlug={slug}
            websiteId={websiteId}
            isAnalyzing={website.status === "analyzing"}
          />
        </div>
      </div>

      {/* Onboarding banner */}
      {website.status === "draft" && (
        <OnboardingBanner
          orgSlug={slug}
          websiteId={websiteId}
          websiteUrl={website.url}
          onDismiss={reloadData}
        />
      )}

      {/* Status banner */}
      {website.status === "analyzing" && (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-center gap-3 py-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            <div>
              <p className="text-sm font-medium">Analyse en cours</p>
              <p className="text-xs text-muted-foreground">
                Identification des requêtes de recherche pertinentes en cours...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Queries Dialog */}
      <GenerateQueriesDialog
        orgSlug={slug}
        websiteId={websiteId}
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onSuccess={() => {
          setShowGenerateDialog(false);
          reloadData();
        }}
      />

      {/* Layout 3 colonnes */}
      <div className="grid grid-cols-3 gap-4">
        {/* Colonne 1: Requêtes */}
        <Card className="h-[calc(100vh-180px)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Requêtes ({filteredQueries.length})
              </CardTitle>
              <Link href={`/dashboard/o/${slug}/w/${websiteId}/queries`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Tout voir
                </Button>
              </Link>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer..."
                value={queryFilter}
                onChange={(e) => setQueryFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60%]">Requête</TableHead>
                    <TableHead className="text-center">Position</TableHead>
                    <TableHead className="text-center w-[60px]">Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQueries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                        {queryFilter ? "Aucun résultat" : "Aucune requête"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredQueries.map((query) => {
                      const latestPosition = query.serpResults[0]?.position;
                      const trend = getTrend(query.serpResults);
                      return (
                        <TableRow
                          key={query.id}
                          className="cursor-pointer"
                          onClick={() => window.location.href = `/dashboard/o/${slug}/w/${websiteId}/queries/${query.id}`}
                        >
                          <TableCell className="py-2">
                            <div className="text-xs font-medium truncate">{query.query}</div>
                            {query.description && (
                              <div className="text-xs text-muted-foreground truncate">
                                {query.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="text-xs font-semibold">
                              {latestPosition !== null && latestPosition !== undefined && latestPosition > 0
                                ? `#${latestPosition}`
                                : query.serpResults.length > 0
                                  ? <span className="text-orange-500">-</span>
                                  : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-2">
                            {getTrendIcon(trend)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Colonne 2: Concurrents */}
        <Card className="h-[calc(100vh-180px)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Concurrents ({filteredCompetitors.length})
              </CardTitle>
              <Link href={`/dashboard/o/${slug}/w/${websiteId}/competitors`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Tout voir
                </Button>
              </Link>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer..."
                value={competitorFilter}
                onChange={(e) => setCompetitorFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-center w-[80px]">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompetitors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                        {competitorFilter ? "Aucun résultat" : "Aucun concurrent"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompetitors.map((competitor) => (
                      <TableRow
                        key={competitor.id}
                        className="cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/o/${slug}/w/${websiteId}/competitors/${competitor.id}`}
                      >
                        <TableCell className="py-2">
                          <div className="text-xs font-medium">{competitor.name}</div>
                        </TableCell>
                        <TableCell className="py-2">
                          <a
                            href={competitor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {competitor.url.replace(/^https?:\/\/(www\.)?/, '')}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell className="py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <CompetitorScore
                            orgSlug={slug}
                            websiteId={websiteId}
                            competitorId={competitor.id}
                            competitorUrl={competitor.url}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Colonne 3: Rapports */}
        <Card className="h-[calc(100vh-180px)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Rapports ({filteredReports.length})
              </CardTitle>
              <Link href={`/dashboard/o/${slug}/w/${websiteId}/reports`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Tout voir
                </Button>
              </Link>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer..."
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-8">
                        {reportFilter ? "Aucun résultat" : "Aucun rapport"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/o/${slug}/w/${websiteId}/reports/${report.id}`}
                      >
                        <TableCell className="py-2">
                          <span className="text-xs">
                            {report.type === "initial_analysis"
                              ? "Initial"
                              : report.type === "periodic_recap"
                              ? "Périodique"
                              : "Concurrent"}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-xs font-medium truncate">{report.title}</div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
