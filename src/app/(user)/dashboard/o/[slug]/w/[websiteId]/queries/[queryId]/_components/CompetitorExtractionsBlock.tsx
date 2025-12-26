"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Download, 
  ExternalLink, 
  Loader2, 
  Sparkles,
  TrendingUp,
  FileText,
  Hash,
} from "lucide-react";

interface CompetitorExtraction {
  id: string;
  url: string;
  position: number | null;
  status: string;
  type: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headings?: { h2?: string[]; h3?: string[]; h4?: string[]; h5?: string[]; h6?: string[] } | null;
  keywords: Array<{
    keyword: string;
    frequency: number;
    density: number;
    score: number;
  }> | null;
  extractedAt: string | null;
  competitor: {
    id: string;
    name: string;
    url: string;
  } | null;
}

interface Props {
  orgSlug: string;
  websiteId: string;
  queryId: string;
}

interface SerpResult {
  url: string;
  position: number | null;
  title: string | null;
  snippet: string | null;
}

export function CompetitorExtractionsBlock({ websiteId, queryId }: Props) {
  const [extractions, setExtractions] = useState<CompetitorExtraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [serpResults, setSerpResults] = useState<SerpResult[]>([]);

  // Charger les résultats SERP et les extractions
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Charger les résultats SERP
      const serpResponse = await fetch(`/api/websites/${websiteId}/queries/${queryId}/serp`);
      if (serpResponse.ok) {
        const serpData = await serpResponse.json();
        setSerpResults(serpData.results || []);
      }

      // Charger les extractions existantes
      const extractionsResponse = await fetch(
        `/api/websites/${websiteId}/queries/${queryId}/competitor-extractions`
      );
      if (extractionsResponse.ok) {
        const { extractions: extractionsData } = await extractionsResponse.json();
        setExtractions(extractionsData);
      }
    } catch (error) {
      console.error("Erreur de chargement:", error);
    } finally {
      setLoading(false);
    }
  }, [queryId, websiteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh pour les extractions en cours
  useEffect(() => {
    if (extractions.some(e => e.status === "pending" || e.status === "extracting")) {
      const interval = setInterval(() => {
        loadData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [extractions, loadData]);

  async function extractSelected(type: "quick" | "full") {
    if (selectedUrls.size === 0) return;

    try {
      setExtracting(true);
      
      const urls = Array.from(selectedUrls).map(url => {
        const serpResult = serpResults.find(r => r.url === url);
        return {
          url,
          position: serpResult?.position || null,
        };
      });

      const response = await fetch(
        `/api/websites/${websiteId}/queries/${queryId}/competitor-extractions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls, type }),
        }
      );

      if (response.ok) {
        setSelectedUrls(new Set());
        setTimeout(() => loadData(), 1000);
      }
    } catch (error) {
      console.error("Erreur d'extraction:", error);
    } finally {
      setExtracting(false);
    }
  }

  function toggleUrl(url: string) {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  }

  // Filtrer les URLs SERP qui ne sont pas déjà extraites
  const availableUrls = serpResults.filter(
    result => result.url && !extractions.some(e => e.url === result.url)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section de sélection */}
      {availableUrls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extraire les pages concurrentes</CardTitle>
            <CardDescription>
              Sélectionnez les pages des résultats SERP à analyser
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableUrls.map((result) => (
                <div
                  key={result.url}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedUrls.has(result.url)}
                    onCheckedChange={() => toggleUrl(result.url)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {result.position && (
                        <Badge variant="outline" className="text-xs">
                          #{result.position}
                        </Badge>
                      )}
                      <span className="text-sm font-medium truncate">
                        {result.title || result.url}
                      </span>
                    </div>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block"
                    >
                      {result.url}
                    </a>
                    {result.snippet && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.snippet}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedUrls.size > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button
                  onClick={() => extractSelected("quick")}
                  disabled={extracting}
                  variant="default"
                >
                  {extracting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Extraction rapide ({selectedUrls.size})
                </Button>
                <Button
                  onClick={() => extractSelected("full")}
                  disabled={extracting}
                  variant="outline"
                >
                  {extracting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  Extraction complète ({selectedUrls.size})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Liste des extractions */}
      {extractions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extractions des concurrents</CardTitle>
            <CardDescription>
              {extractions.length} page{extractions.length > 1 ? "s" : ""} analysée{extractions.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extractions.map((extraction) => (
              <div
                key={extraction.id}
                className="p-4 rounded-lg border space-y-3"
              >
                {/* En-tête */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {extraction.position && (
                        <Badge variant="outline">#{extraction.position}</Badge>
                      )}
                      {extraction.competitor && (
                        <Badge variant="secondary">
                          {extraction.competitor.name}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          extraction.status === "completed"
                            ? "default"
                            : extraction.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {extraction.status === "completed" && "Terminé"}
                        {extraction.status === "pending" && "En attente"}
                        {extraction.status === "extracting" && "Extraction..."}
                        {extraction.status === "failed" && "Échec"}
                      </Badge>
                      {extraction.type && (
                        <Badge variant="outline">
                          {extraction.type === "quick" ? "Rapide" : "Complet"}
                        </Badge>
                      )}
                    </div>
                    <a
                      href={extraction.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                    >
                      {extraction.url}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                </div>

                {/* Contenu extrait */}
                {extraction.status === "completed" && (
                  <div className="space-y-3 pt-3 border-t">
                    {/* Extraction rapide */}
                    {extraction.title && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Title
                        </div>
                        <div className="text-sm">{extraction.title}</div>
                      </div>
                    )}

                    {extraction.metaDescription && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Meta Description
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {extraction.metaDescription}
                        </div>
                      </div>
                    )}

                    {extraction.h1 && extraction.h1.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          H1
                        </div>
                        <div className="space-y-1">
                          {extraction.h1.map((h, i) => (
                            <div key={i} className="text-sm flex items-start gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                              {h}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extraction complète */}
                    {extraction.type === "full" && extraction.headings && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Structure des headings
                        </div>
                        <div className="space-y-2 text-sm">
                          {(["h2", "h3", "h4", "h5", "h6"] as const).map((level) => {
                            const headings = extraction.headings?.[level];
                            if (!headings || headings.length === 0) return null;
                            return (
                              <div key={level}>
                                <div className="text-xs text-muted-foreground mb-1">
                                  {level.toUpperCase()} ({headings.length})
                                </div>
                                <div className="space-y-1 pl-4">
                                  {headings.slice(0, 3).map((h: string, i: number) => (
                                    <div key={i} className="text-xs text-muted-foreground">
                                      • {h}
                                    </div>
                                  ))}
                                  {headings.length > 3 && (
                                    <div className="text-xs text-muted-foreground italic">
                                      ... et {headings.length - 3} de plus
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {extraction.type === "full" && extraction.keywords && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Mots-clés pondérés (Top 10)
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {extraction.keywords.slice(0, 10).map((kw, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 rounded bg-secondary/50"
                            >
                              <span className="text-sm truncate">{kw.keyword}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  <Hash className="w-3 h-3 mr-1" />
                                  {kw.frequency}
                                </Badge>
                                <Badge variant="default" className="text-xs">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  {kw.score}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {extraction.status === "extracting" && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Extraction en cours...
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {extractions.length === 0 && availableUrls.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aucune page concurrente
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Lancez une analyse SERP pour identifier les pages concurrentes à extraire.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
