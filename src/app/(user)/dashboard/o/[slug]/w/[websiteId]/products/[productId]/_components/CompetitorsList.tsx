"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Trash2,
  RotateCcw,
} from "lucide-react";

interface CompetitorsListProps {
  orgSlug: string;
  websiteId: string;
  productId: string;
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  description: string | null;
  sharedKeywords: number;
  totalKeywordsTracked: number;
  avgDifference: number;
  threat: "high" | "medium" | "low";
  comparison: Array<{
    keyword: string;
    ourPosition: number;
    competitorPosition: number;
    difference: number;
    weAreBetter: boolean;
  }>;
}

interface Summary {
  totalCompetitors: number;
  highThreat: number;
  mediumThreat: number;
  lowThreat: number;
  ourKeywords: string[];
  searchedQueries: string[];
}

export function CompetitorsList({ orgSlug, websiteId, productId }: CompetitorsListProps) {
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/products/${productId}/competitors`
      );
      const json = await res.json();

      if (json.success) {
        setCompetitors(json.data.competitors);
        setSummary(json.data.summary);
      }
    } catch (error) {
      console.error("Failed to fetch competitors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/products/${productId}/serp/reanalyze`,
        { method: "POST" }
      );
      const json = await res.json();
      
      if (json.success) {
        console.log("Re-analysis result:", json.data);
        // Refresh the competitors list
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to re-analyze:", error);
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDeleteCompetitor = async (competitorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce concurrent ?")) return;
    
    setDeletingId(competitorId);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/competitors/${competitorId}`,
        { method: "DELETE" }
      );
      
      if (res.ok) {
        // Remove from local state
        setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
      }
    } catch (error) {
      console.error("Failed to delete competitor:", error);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/products/${productId}/competitors`
        );
        const json = await res.json();

        if (json.success) {
          setCompetitors(json.data.competitors);
          setSummary(json.data.summary);
        }
      } catch (error) {
        console.error("Failed to fetch competitors:", error);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [orgSlug, websiteId, productId]);

  const getThreatIcon = (threat: string) => {
    switch (threat) {
      case "high":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "medium":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    }
  };

  const getThreatLabel = (threat: string) => {
    switch (threat) {
      case "high":
        return "Menace élevée";
      case "medium":
        return "Menace moyenne";
      default:
        return "Menace faible";
    }
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
            <CardTitle>Concurrents identifiés</CardTitle>
            <CardDescription>
              Concurrents présents sur les mêmes mots-clés que ce produit
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReanalyze}
              disabled={reanalyzing}
            >
              {reanalyzing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Ré-analyser
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        {summary && summary.totalCompetitors > 0 && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{summary.highThreat}</p>
                <p className="text-sm text-muted-foreground">Menaces élevées</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-900">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{summary.mediumThreat}</p>
                <p className="text-sm text-muted-foreground">Menaces moyennes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{summary.lowThreat}</p>
                <p className="text-sm text-muted-foreground">Menaces faibles</p>
              </div>
            </div>
          </div>
        )}

        {/* Competitors list */}
        {competitors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">Aucun concurrent identifié pour le moment.</p>
            <p className="text-sm">
              Les concurrents sont détectés automatiquement lors des analyses SERP.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {competitors.map((competitor) => (
              <div
                key={competitor.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setExpandedCompetitor(
                      expandedCompetitor === competitor.id ? null : competitor.id
                    )
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getThreatIcon(competitor.threat)}
                      <div>
                        <h4 className="font-medium">{competitor.name}</h4>
                        <a
                          href={competitor.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {new URL(competitor.url).hostname}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {competitor.sharedKeywords} mot(s)-clé(s) en commun
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getThreatLabel(competitor.threat)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDeleteCompetitor(competitor.id, e)}
                        disabled={deletingId === competitor.id}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        {deletingId === competitor.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded view with keyword comparison */}
                {expandedCompetitor === competitor.id && (
                  <div className="px-4 pb-4 border-t bg-muted/30">
                    <h5 className="text-sm font-medium mt-4 mb-3">
                      Comparaison par mot-clé
                    </h5>
                    {competitor.comparison.length > 0 ? (
                      <div className="space-y-2">
                        {competitor.comparison.map((cmp) => (
                          <div
                            key={cmp.keyword}
                            className="flex items-center gap-4 p-2 rounded bg-background"
                          >
                            <span className="flex-1 text-sm truncate" title={cmp.keyword}>
                              {cmp.keyword}
                            </span>
                            <div className="flex items-center gap-6">
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Nous</p>
                                <p className="font-bold">#{cmp.ourPosition}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-muted-foreground">Eux</p>
                                <p className="font-bold">#{cmp.competitorPosition}</p>
                              </div>
                              <div className="w-8 flex justify-center">
                                {cmp.weAreBetter ? (
                                  <TrendingUp className="w-5 h-5 text-green-500" />
                                ) : cmp.difference === 0 ? (
                                  <span className="text-gray-400">=</span>
                                ) : (
                                  <TrendingDown className="w-5 h-5 text-red-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune donnée de comparaison disponible.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
