"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Lightbulb,
  Check,
  X,
  FileText,
  Key,
  Settings,
  Link as LinkIcon,
  Type,
  List,
  PlusCircle,
} from "lucide-react";

interface SuggestionsListProps {
  orgSlug: string;
  websiteId: string;
  queryId: string;
}

interface Suggestion {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: number;
  status: "pending" | "accepted" | "dismissed";
  createdAt: string;
}

interface Stats {
  total: number;
  pending: number;
  accepted: number;
  dismissed: number;
  byPriority: { high: number; medium: number; low: number };
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  content: {
    icon: FileText,
    label: "Contenu",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  keyword: {
    icon: Key,
    label: "Mot-clé",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  technical: {
    icon: Settings,
    label: "Technique",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  backlink: {
    icon: LinkIcon,
    label: "Backlink",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  title: {
    icon: Type,
    label: "Title",
    color: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  },
  description: {
    icon: FileText,
    label: "Description",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  },
  url: {
    icon: LinkIcon,
    label: "URL",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  },
  headings: {
    icon: List,
    label: "Headings",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  },
  new_page: {
    icon: PlusCircle,
    label: "Nouvelle page",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export function SuggestionsList({ orgSlug, websiteId, queryId }: SuggestionsListProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "dismissed">("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const statusParam = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/suggestions${statusParam}`
      );
      const json = await res.json();

      if (json.success) {
        setSuggestions(json.data.suggestions);
        setStats(json.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [orgSlug, websiteId, queryId, filter]);

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/suggestions`,
        { method: "POST" }
      );
      const json = await res.json();

      if (json.success) {
        // Refetch to get updated list
        await fetchData();
      } else {
        console.error("Failed to generate:", json.error);
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (suggestionId: string, status: "accepted" | "dismissed") => {
    setUpdatingId(suggestionId);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}/suggestions/${suggestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const json = await res.json();

      if (json.success) {
        // Update local state
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status } : s))
        );
        // Remove from list if filtered
        if (filter !== "all" && filter !== status) {
          setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        }
      }
    } catch (error) {
      console.error("Failed to update suggestion:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 8)
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
          Haute
        </span>
      );
    if (priority >= 5)
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
          Moyenne
        </span>
      );
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        Basse
      </span>
    );
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Suggestions d&apos;amélioration
            </CardTitle>
            <CardDescription>
              Recommandations générées par l&apos;IA pour améliorer votre visibilité
            </CardDescription>
          </div>
          <Button
            onClick={generateSuggestions}
            disabled={generating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Génération..." : "Générer des suggestions"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="flex gap-2 mb-4">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Toutes ({stats.total})
            </Button>
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              En attente ({stats.pending})
            </Button>
            <Button
              variant={filter === "accepted" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("accepted")}
            >
              Acceptées ({stats.accepted})
            </Button>
            <Button
              variant={filter === "dismissed" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("dismissed")}
            >
              Rejetées ({stats.dismissed})
            </Button>
          </div>
        )}

        {/* Suggestions list */}
        {suggestions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">
              {filter === "pending"
                ? "Aucune suggestion en attente."
                : filter === "accepted"
                  ? "Aucune suggestion acceptée."
                  : filter === "dismissed"
                    ? "Aucune suggestion rejetée."
                    : "Aucune suggestion générée."}
            </p>
            {filter === "all" && (
              <Button onClick={generateSuggestions} disabled={generating}>
                <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
                Générer des suggestions
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion) => {
              const defaultConfig = {
                icon: Lightbulb,
                label: suggestion.type,
                color: "bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300",
              };
              const typeConfig = TYPE_CONFIG[suggestion.type] || defaultConfig;
              const TypeIcon = typeConfig.icon;

              return (
                <div
                  key={suggestion.id}
                  className={`p-4 rounded-lg border ${
                    suggestion.status === "dismissed" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded ${typeConfig.color}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${typeConfig.color}`}>
                            {typeConfig.label}
                          </span>
                          {getPriorityBadge(suggestion.priority)}
                          {suggestion.status !== "pending" && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                suggestion.status === "accepted"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {suggestion.status === "accepted" ? "Acceptée" : "Rejetée"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {suggestion.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(suggestion.id, "accepted")}
                          disabled={updatingId === suggestion.id}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(suggestion.id, "dismissed")}
                          disabled={updatingId === suggestion.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground ml-11">
                    {suggestion.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
