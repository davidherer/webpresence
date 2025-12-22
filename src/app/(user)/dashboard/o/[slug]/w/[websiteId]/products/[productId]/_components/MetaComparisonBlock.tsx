"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  XCircle,
  Sparkles,
} from "lucide-react";

interface MetaComparisonBlockProps {
  orgSlug: string;
  websiteId: string;
  productId: string;
}

interface KeywordItem {
  word: string;
  count: number;
}

interface BigramItem {
  phrase: string;
  count: number;
}

interface ClientData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  titleLength: number;
  descriptionLength: number;
  keywords: {
    title: KeywordItem[];
    description: KeywordItem[];
    all: KeywordItem[];
  };
  bigrams: {
    title: BigramItem[];
    description: BigramItem[];
  };
}

interface CompetitorMeta {
  id: string;
  name: string;
  url: string;
  title: string | null;
  metaDescription: string | null;
  titleLength: number;
  descriptionLength: number;
  keywords: {
    title: KeywordItem[];
    description: KeywordItem[];
  };
  bigrams: BigramItem[];
}

interface TrendingKeyword {
  word: string;
  totalCount: number;
  usedBy: number;
  clientHas: boolean;
  clientCount: number;
}

interface TrendingBigram {
  phrase: string;
  usedBy: number;
  clientHas: boolean;
}

interface MissingKeyword {
  word: string;
  usedBy: number;
  competitors: string[];
}

interface KeywordAnalysis {
  trendingKeywords: TrendingKeyword[];
  trendingBigrams: TrendingBigram[];
  missingKeywords: MissingKeyword[];
  missingTitleKeywords: MissingKeyword[];
  keywordCoverage: number;
}

interface ComparisonData {
  client: ClientData;
  competitors: CompetitorMeta[];
  averages: {
    competitorTitleLength: number;
    competitorDescriptionLength: number;
  };
  recommendations: {
    titleOptimalRange: { min: number; max: number };
    descriptionOptimalRange: { min: number; max: number };
  };
  insights: string[];
  keywordAnalysis: KeywordAnalysis;
  hasData: boolean;
}

export function MetaComparisonBlock({
  orgSlug,
  websiteId,
  productId,
}: MetaComparisonBlockProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComparisonData | null>(null);
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(
    null
  );
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "keywords" | "competitors"
  >("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/products/${productId}/meta-comparison`
      );
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch meta comparison:", error);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, websiteId, productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTitleStatus = (
    length: number,
    optimal: { min: number; max: number }
  ) => {
    if (length === 0) return "missing";
    if (length >= optimal.min && length <= optimal.max) return "optimal";
    if (length < optimal.min) return "short";
    return "long";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "optimal":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "missing":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal":
        return "text-green-600 dark:text-green-400";
      case "missing":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-yellow-600 dark:text-yellow-400";
    }
  };

  const getLengthBarWidth = (length: number, max: number) => {
    return Math.min((length / max) * 100, 100);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Analyse comparative SEO
          </CardTitle>
          <CardDescription>
            Comparaison des balises title et meta description
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">Aucune donnée d&apos;analyse disponible.</p>
            <p className="text-sm">
              Les données seront disponibles après l&apos;analyse des pages.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    client,
    competitors,
    averages,
    recommendations,
    insights,
    keywordAnalysis,
  } = data;
  const displayedCompetitors = showAllCompetitors
    ? competitors
    : competitors.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Analyse comparative SEO
            </CardTitle>
            <CardDescription>
              Comparaison approfondie des balises title, meta description et
              mots-clés
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 border-b">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Vue d&apos;ensemble
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "keywords"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("keywords")}
          >
            Analyse mots-clés
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "competitors"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("competitors")}
          >
            Détail concurrents
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Insights - Always visible */}
        {insights.length > 0 && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Recommandations ({insights.length})
            </h4>
            <ul className="space-y-1">
              {insights.map((insight, i) => (
                <li
                  key={i}
                  className="text-sm text-amber-700 dark:text-amber-300"
                >
                  • {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TAB: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Keyword Coverage Score */}
            {keywordAnalysis.trendingKeywords.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">
                      Couverture mots-clés
                    </span>
                  </div>
                  <div className="text-3xl font-bold">
                    {keywordAnalysis.keywordCoverage}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    des termes tendance utilisés
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-sm font-medium">Mots-clés manquants</span>
                  </div>
                  <div className="text-3xl font-bold">
                    {keywordAnalysis.missingKeywords.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    utilisés par 2+ concurrents
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    <span className="text-sm font-medium">Concurrents analysés</span>
                  </div>
                  <div className="text-3xl font-bold">{competitors.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    avec données SEO
                  </p>
                </div>
              </div>
            )}

            {/* Your site section */}
            <div className="space-y-4">
              <h4 className="font-medium text-lg border-b pb-2">Votre site</h4>

              {/* Title */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {getStatusIcon(
                      getTitleStatus(
                        client.titleLength,
                        recommendations.titleOptimalRange
                      )
                    )}
                    Title
                  </span>
                  <span
                    className={`text-sm ${getStatusColor(
                      getTitleStatus(
                        client.titleLength,
                        recommendations.titleOptimalRange
                      )
                    )}`}
                  >
                    {client.titleLength} / {recommendations.titleOptimalRange.max}{" "}
                    caractères
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      getTitleStatus(
                        client.titleLength,
                        recommendations.titleOptimalRange
                      ) === "optimal"
                        ? "bg-green-500"
                        : getTitleStatus(
                            client.titleLength,
                            recommendations.titleOptimalRange
                          ) === "missing"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                    style={{
                      width: `${getLengthBarWidth(
                        client.titleLength,
                        recommendations.titleOptimalRange.max
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg break-all">
                  {client.title || (
                    <em className="text-red-500">Aucun title défini</em>
                  )}
                </p>
                {client.keywords.title.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {client.keywords.title.map((kw) => (
                      <span
                        key={kw.word}
                        className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded"
                      >
                        {kw.word}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Meta Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {getStatusIcon(
                      getTitleStatus(
                        client.descriptionLength,
                        recommendations.descriptionOptimalRange
                      )
                    )}
                    Meta Description
                  </span>
                  <span
                    className={`text-sm ${getStatusColor(
                      getTitleStatus(
                        client.descriptionLength,
                        recommendations.descriptionOptimalRange
                      )
                    )}`}
                  >
                    {client.descriptionLength} /{" "}
                    {recommendations.descriptionOptimalRange.max} caractères
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      getTitleStatus(
                        client.descriptionLength,
                        recommendations.descriptionOptimalRange
                      ) === "optimal"
                        ? "bg-green-500"
                        : getTitleStatus(
                            client.descriptionLength,
                            recommendations.descriptionOptimalRange
                          ) === "missing"
                        ? "bg-red-500"
                        : "bg-yellow-500"
                    }`}
                    style={{
                      width: `${getLengthBarWidth(
                        client.descriptionLength,
                        recommendations.descriptionOptimalRange.max
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg break-all">
                  {client.metaDescription || (
                    <em className="text-red-500">Aucune description définie</em>
                  )}
                </p>
                {client.keywords.description.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {client.keywords.description.map((kw) => (
                      <span
                        key={kw.word}
                        className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded"
                      >
                        {kw.word}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick comparison */}
            {competitors.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-medium text-lg">
                    Comparaison rapide ({competitors.length} concurrents)
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Site</th>
                        <th className="text-center py-2 font-medium">Title</th>
                        <th className="text-center py-2 font-medium">Description</th>
                        <th className="text-center py-2 font-medium">
                          Mots-clés
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b bg-primary/5">
                        <td className="py-2 font-medium">Vous</td>
                        <td className="text-center py-2">{client.titleLength}</td>
                        <td className="text-center py-2">
                          {client.descriptionLength}
                        </td>
                        <td className="text-center py-2">
                          {client.keywords.all.length}
                        </td>
                      </tr>
                      {competitors.slice(0, 5).map((comp) => (
                        <tr key={comp.id} className="border-b">
                          <td className="py-2 truncate max-w-[150px]" title={comp.name}>
                            {comp.name}
                          </td>
                          <td className="text-center py-2">{comp.titleLength}</td>
                          <td className="text-center py-2">
                            {comp.descriptionLength}
                          </td>
                          <td className="text-center py-2">
                            {comp.keywords.title.length +
                              comp.keywords.description.length}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-medium bg-muted">
                        <td className="py-2">Moyenne</td>
                        <td className="text-center py-2">
                          {averages.competitorTitleLength}
                        </td>
                        <td className="text-center py-2">
                          {averages.competitorDescriptionLength}
                        </td>
                        <td className="text-center py-2">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Keywords Analysis */}
        {activeTab === "keywords" && (
          <div className="space-y-6">
            {/* Trending Keywords */}
            {keywordAnalysis.trendingKeywords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Mots-clés tendance chez les concurrents
                </h4>
                <p className="text-sm text-muted-foreground">
                  Termes utilisés par au moins 2 concurrents. Les termes en vert
                  sont présents sur votre site.
                </p>
                <div className="flex flex-wrap gap-2">
                  {keywordAnalysis.trendingKeywords.map((kw) => (
                    <div
                      key={kw.word}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                        kw.clientHas
                          ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700"
                          : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      <span className="font-medium">{kw.word}</span>
                      <span className="text-xs opacity-70">
                        ({kw.usedBy} conc.)
                      </span>
                      {kw.clientHas ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Keywords */}
            {keywordAnalysis.missingKeywords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Mots-clés manquants sur votre page
                </h4>
                <p className="text-sm text-muted-foreground">
                  Ces termes sont utilisés par plusieurs concurrents mais sont
                  absents de votre title et meta description.
                </p>
                <div className="space-y-2">
                  {keywordAnalysis.missingKeywords.map((kw) => (
                    <div
                      key={kw.word}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                    >
                      <div>
                        <span className="font-medium text-red-800 dark:text-red-200">
                          {kw.word}
                        </span>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          Utilisé par : {kw.competitors.slice(0, 3).join(", ")}
                          {kw.competitors.length > 3 &&
                            ` +${kw.competitors.length - 3}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">
                        {kw.usedBy} concurrent{kw.usedBy > 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Title Keywords */}
            {keywordAnalysis.missingTitleKeywords.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Mots-clés manquants spécifiquement dans votre Title
                </h4>
                <div className="flex flex-wrap gap-2">
                  {keywordAnalysis.missingTitleKeywords.map((kw) => (
                    <span
                      key={kw.word}
                      className="px-3 py-1 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-sm"
                    >
                      {kw.word}{" "}
                      <span className="opacity-70">({kw.usedBy} conc.)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Bigrams */}
            {keywordAnalysis.trendingBigrams.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Expressions (bi-grammes) populaires
                </h4>
                <p className="text-sm text-muted-foreground">
                  Combinaisons de 2 mots utilisées par plusieurs concurrents.
                </p>
                <div className="flex flex-wrap gap-2">
                  {keywordAnalysis.trendingBigrams.map((bg) => (
                    <div
                      key={bg.phrase}
                      className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                        bg.clientHas
                          ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span>&quot;{bg.phrase}&quot;</span>
                      <span className="text-xs opacity-70">
                        ({bg.usedBy} conc.)
                      </span>
                      {bg.clientHas && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Your Keywords */}
            {client.keywords.all.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Vos mots-clés actuels</h4>
                <div className="flex flex-wrap gap-2">
                  {client.keywords.all.map((kw) => (
                    <span
                      key={kw.word}
                      className="px-2 py-1 rounded bg-primary/10 text-primary text-sm"
                    >
                      {kw.word} <span className="opacity-50">×{kw.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Competitors Detail */}
        {activeTab === "competitors" && competitors.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-medium text-lg">
                Concurrents ({competitors.length})
              </h4>
              <div className="text-sm text-muted-foreground">
                Moy. title: {averages.competitorTitleLength} car. | Moy. desc:{" "}
                {averages.competitorDescriptionLength} car.
              </div>
            </div>

            <div className="space-y-3">
              {displayedCompetitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <div
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                    onClick={() =>
                      setExpandedCompetitor(
                        expandedCompetitor === competitor.id
                          ? null
                          : competitor.id
                      )
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h5 className="font-medium">{competitor.name}</h5>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {new URL(competitor.url).hostname}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <span className="text-muted-foreground">Title: </span>
                        <span
                          className={
                            competitor.titleLength > 0 ? "" : "text-red-500"
                          }
                        >
                          {competitor.titleLength} car.
                        </span>
                        <span className="mx-2 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">Desc: </span>
                        <span
                          className={
                            competitor.descriptionLength > 0
                              ? ""
                              : "text-red-500"
                          }
                        >
                          {competitor.descriptionLength} car.
                        </span>
                      </div>
                      {expandedCompetitor === competitor.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {expandedCompetitor === competitor.id && (
                    <div className="px-4 pb-4 border-t bg-muted/30 space-y-4">
                      <div className="pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Title
                        </p>
                        <p className="text-sm bg-background p-2 rounded break-all">
                          {competitor.title || (
                            <em className="text-muted-foreground">Non défini</em>
                          )}
                        </p>
                        {competitor.keywords.title.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {competitor.keywords.title.map((kw) => (
                              <span
                                key={kw.word}
                                className={`px-2 py-0.5 text-xs rounded ${
                                  client.keywords.title.some(
                                    (ck) => ck.word === kw.word
                                  )
                                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                {kw.word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Meta Description
                        </p>
                        <p className="text-sm bg-background p-2 rounded break-all">
                          {competitor.metaDescription || (
                            <em className="text-muted-foreground">
                              Non définie
                            </em>
                          )}
                        </p>
                        {competitor.keywords.description.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {competitor.keywords.description.map((kw) => (
                              <span
                                key={kw.word}
                                className={`px-2 py-0.5 text-xs rounded ${
                                  client.keywords.description.some(
                                    (ck) => ck.word === kw.word
                                  )
                                    ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                                }`}
                              >
                                {kw.word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {competitor.bigrams.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Expressions clés
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {competitor.bigrams.map((bg) => (
                              <span
                                key={bg.phrase}
                                className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded"
                              >
                                {bg.phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {competitors.length > 3 && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowAllCompetitors(!showAllCompetitors)}
              >
                {showAllCompetitors ? (
                  <>
                    <ChevronUp className="w-4 h-4 mr-2" />
                    Voir moins
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 mr-2" />
                    Voir tous les concurrents ({competitors.length - 3} de plus)
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
