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
  Sparkles,
  Zap,
  Target,
  FileText,
  Link2,
  List,
  PlusCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Lightbulb,
  Rocket,
} from "lucide-react";

interface AISuggestionsBlockProps {
  orgSlug: string;
  websiteId: string;
  queryId: string;
}

interface SEOSuggestion {
  type: "title" | "description" | "url" | "headings" | "new_page" | "content" | "keyword";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  currentValue?: string | object;
  suggestedValue?: string | object;
  reasoning: string;
}

// Helper to safely convert value to string for display
function valueToString(value: string | object | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

interface SuggestionsData {
  suggestions: SEOSuggestion[];
  globalAnalysis: string;
  quickWins: string[];
  longTermStrategy: string[];
  savedCount: number;
}

const typeIcons: Record<string, React.ReactNode> = {
  title: <FileText className="w-4 h-4" />,
  description: <FileText className="w-4 h-4" />,
  url: <Link2 className="w-4 h-4" />,
  headings: <List className="w-4 h-4" />,
  new_page: <PlusCircle className="w-4 h-4" />,
  content: <FileText className="w-4 h-4" />,
  keyword: <Tag className="w-4 h-4" />,
};

const typeLabels: Record<string, string> = {
  title: "Title",
  description: "Meta Description",
  url: "URL",
  headings: "Structure Headings",
  new_page: "Nouvelle page",
  content: "Contenu",
  keyword: "Mots-clés",
};

const priorityColors: Record<string, string> = {
  high: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
  medium: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  low: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
};

const priorityLabels: Record<string, string> = {
  high: "Priorité haute",
  medium: "Priorité moyenne",
  low: "Priorité basse",
};

export function AISuggestionsBlock({
  orgSlug,
  websiteId,
  queryId,
}: AISuggestionsBlockProps) {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<SuggestionsData | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const fetchExistingSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/seo-suggestions`
      );
      const json = await res.json();

      if (json.success && json.data.suggestions?.length > 0) {
        // Transform saved suggestions to match our format
        setData({
          suggestions: json.data.suggestions.map((s: { type: string; title: string; content: string; priority: number }) => ({
            type: s.type,
            priority: s.priority >= 8 ? "high" : s.priority >= 4 ? "medium" : "low",
            title: s.title,
            description: s.content,
            reasoning: "",
          })),
          globalAnalysis: "",
          quickWins: [],
          longTermStrategy: [],
          savedCount: json.data.suggestions.length,
        });
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, websiteId, queryId]);

  useEffect(() => {
    fetchExistingSuggestions();
  }, [fetchExistingSuggestions]);

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/seo-suggestions`,
        { method: "POST" }
      );
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        console.error("Failed to generate suggestions:", json.error);
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const filteredSuggestions = data?.suggestions.filter(
    (s) => !activeFilter || s.type === activeFilter
  ) || [];

  const suggestionTypes = data?.suggestions
    ? [...new Set(data.suggestions.map((s) => s.type))]
    : [];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Suggestions IA
            </CardTitle>
            <CardDescription>
              Recommandations SEO générées par Mistral AI basées sur l&apos;analyse comparative
            </CardDescription>
          </div>
          <Button
            onClick={generateSuggestions}
            disabled={generating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {data ? "Régénérer" : "Générer les suggestions"}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!data && !generating && (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <p className="mb-2 font-medium">Aucune suggestion générée</p>
            <p className="text-sm mb-4">
              Cliquez sur &quot;Générer les suggestions&quot; pour obtenir des recommandations SEO 
              personnalisées basées sur l&apos;analyse de vos concurrents.
            </p>
          </div>
        )}

        {generating && (
          <div className="text-center py-12">
            <div className="relative">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-500 animate-pulse" />
              <RefreshCw className="w-6 h-6 absolute top-0 right-1/2 translate-x-8 text-blue-500 animate-spin" />
            </div>
            <p className="font-medium text-purple-600 dark:text-purple-400">
              Mistral AI analyse vos données...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Génération de recommandations SEO personnalisées
            </p>
          </div>
        )}

        {data && !generating && (
          <>
            {/* Global Analysis */}
            {data.globalAnalysis && (
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Analyse globale
                </h4>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {data.globalAnalysis}
                </p>
              </div>
            )}

            {/* Quick Wins & Long Term Strategy */}
            {(data.quickWins.length > 0 || data.longTermStrategy.length > 0) && (
              <div className="grid gap-4 md:grid-cols-2">
                {data.quickWins.length > 0 && (
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Quick Wins
                    </h4>
                    <ul className="space-y-2">
                      {data.quickWins.map((win, i) => (
                        <li
                          key={i}
                          className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {win}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.longTermStrategy.length > 0 && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <Rocket className="w-4 h-4" />
                      Stratégie long terme
                    </h4>
                    <ul className="space-y-2">
                      {data.longTermStrategy.map((strategy, i) => (
                        <li
                          key={i}
                          className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2"
                        >
                          <Target className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {strategy}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Filter by type */}
            {suggestionTypes.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={activeFilter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(null)}
                >
                  Tout ({data.suggestions.length})
                </Button>
                {suggestionTypes.map((type) => (
                  <Button
                    key={type}
                    variant={activeFilter === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(type)}
                    className="flex items-center gap-1"
                  >
                    {typeIcons[type]}
                    {typeLabels[type]} (
                    {data.suggestions.filter((s) => s.type === type).length})
                  </Button>
                ))}
              </div>
            )}

            {/* Suggestions List */}
            <div className="space-y-3">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="border rounded-lg overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() =>
                      setExpandedSuggestion(
                        expandedSuggestion === index ? null : index
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="p-2 rounded-lg bg-muted">
                          {typeIcons[suggestion.type]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                              {typeLabels[suggestion.type]}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${
                                priorityColors[suggestion.priority]
                              }`}
                            >
                              {priorityLabels[suggestion.priority]}
                            </span>
                          </div>
                          <h5 className="font-medium">{suggestion.title}</h5>
                        </div>
                      </div>
                      {expandedSuggestion === index ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {expandedSuggestion === index && (
                    <div className="px-4 pb-4 border-t bg-muted/30 space-y-4">
                      <div className="pt-4">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {suggestion.description}
                        </p>
                      </div>

                      {suggestion.currentValue && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-red-500" />
                            Valeur actuelle
                          </p>
                          <div className="p-3 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-800 dark:text-red-200 break-all whitespace-pre-wrap">
                              {valueToString(suggestion.currentValue)}
                            </p>
                          </div>
                        </div>
                      )}

                      {suggestion.suggestedValue && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            Valeur suggérée
                          </p>
                          <div className="p-3 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 relative">
                            <p className="text-sm text-green-800 dark:text-green-200 break-all pr-8 whitespace-pre-wrap">
                              {valueToString(suggestion.suggestedValue)}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(valueToString(suggestion.suggestedValue), index);
                              }}
                              className="absolute top-2 right-2 p-1.5 rounded hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                              title="Copier"
                            >
                              {copiedIndex === index ? (
                                <Check className="w-4 h-4 text-green-600" />
                              ) : (
                                <Copy className="w-4 h-4 text-green-600" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {suggestion.reasoning && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Lightbulb className="w-3 h-3 text-yellow-500" />
                            Raisonnement SEO
                          </p>
                          <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                            {suggestion.reasoning}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t">
              <Clock className="w-3 h-3" />
              {data.savedCount} suggestions enregistrées
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
