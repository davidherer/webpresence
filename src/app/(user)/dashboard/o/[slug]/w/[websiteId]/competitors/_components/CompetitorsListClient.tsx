"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Users2,
  Globe,
  Loader2,
} from "lucide-react";

interface Score {
  better: number;
  worse: number;
  total: number;
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  createdAt: Date;
  score: Score;
}

interface CompetitorsListClientProps {
  orgSlug: string;
  websiteId: string;
  competitors: Competitor[];
}

export default function CompetitorsListClient({
  orgSlug,
  websiteId,
  competitors,
}: CompetitorsListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(competitors.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectCompetitor = (competitorId: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(competitorId);
    } else {
      newSelection.delete(competitorId);
    }
    setSelectedIds(newSelection);
  };

  const handleAnalyzeSitemaps = async () => {
    if (selectedIds.size === 0) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/competitors/batch-analyze-sitemap`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitorIds: Array.from(selectedIds) }),
        }
      );

      if (response.ok) {
        alert(`Analyse de sitemap lancée pour ${selectedIds.size} concurrent(s)`);
        setSelectedIds(new Set());
      } else {
        const data = await response.json();
        alert(`Erreur : ${data.error || "Échec de l'analyse"}`);
      }
    } catch (error) {
      console.error("Failed to start batch sitemap analysis:", error);
      alert("Erreur lors du lancement des analyses");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const ScoreDisplay = ({ score }: { score: Score }) => {
    if (score.total === 0) {
      return <span className="text-muted-foreground">-</span>;
    }

    const netScore = score.better - score.worse;
    const isPositive = netScore > 0;
    const isNegative = netScore < 0;

    return (
      <div className="flex items-center gap-2">
        <span
          className={`font-semibold text-lg ${
            isPositive
              ? "text-green-600"
              : isNegative
              ? "text-red-500"
              : "text-muted-foreground"
          }`}
        >
          {netScore > 0 ? "+" : ""}
          {netScore}
        </span>
        {isPositive && <TrendingUp className="w-4 h-4 text-green-600" />}
        {isNegative && <TrendingDown className="w-4 h-4 text-red-500" />}
        {!isPositive && !isNegative && <Minus className="w-4 h-4 text-muted-foreground" />}
      </div>
    );
  };

  const allSelected = competitors.length > 0 && selectedIds.size === competitors.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < competitors.length;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href={`/dashboard/o/${orgSlug}/w/${websiteId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour au site
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users2 className="w-6 h-6" />
          Concurrents
        </h1>

        {competitors.length > 0 && (
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
            )}
            <Button
              onClick={handleAnalyzeSitemaps}
              disabled={selectedIds.size === 0 || isAnalyzing}
              size="sm"
              variant="default"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Analyser les sitemaps
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {competitors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Aucun concurrent identifié pour le moment.
            </p>
            <p className="text-sm text-muted-foreground">
              Les concurrents seront détectés automatiquement lors de l&apos;analyse SERP de vos
              produits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Select All Row */}
          <Card className="mb-3 border-dashed">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  className={someSelected ? "data-[state=checked]:bg-gray-400" : ""}
                />
                <span className="text-sm font-medium">
                  Tout sélectionner ({competitors.length} concurrent{competitors.length > 1 ? "s" : ""})
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {competitors.map((competitor) => {
              const isSelected = selectedIds.has(competitor.id);
              return (
                <Card
                  key={competitor.id}
                  className={`transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectCompetitor(competitor.id, checked as boolean)
                        }
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Content - Clickable link */}
                      <Link
                        href={`/dashboard/o/${orgSlug}/w/${websiteId}/competitors/${competitor.id}`}
                        className="flex items-center justify-between flex-1 min-w-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{competitor.name}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="truncate">{competitor.url}</span>
                            <a
                              href={competitor.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <ScoreDisplay score={competitor.score} />
                          {competitor.score.total > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {competitor.score.better}↑ / {competitor.score.worse}↓ sur{" "}
                              {competitor.score.total} requêtes
                            </p>
                          )}
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Légende du score</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-green-600 font-semibold">+N</span>
            <span>Vous êtes devant le concurrent sur N requêtes de plus</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-red-500 font-semibold">-N</span>
            <span>Le concurrent est devant vous sur N requêtes de plus</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
