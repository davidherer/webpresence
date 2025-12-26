"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw } from "lucide-react";

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

interface QueriesColumnProps {
  queries: SearchQuery[];
  orgSlug: string;
  websiteId: string;
}

const getTrend = (serpResults: { position: number | null }[]) => {
  if (serpResults.length < 2) return null;
  const current = serpResults[0]?.position;
  const previous = serpResults[1]?.position;
  if (current === null || previous === null) return null;
  return previous - current;
};

const getTrendIcon = (trend: number | null) => {
  if (trend === null) return <Minus className="w-4 h-4 text-muted-foreground" />;
  if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

export function QueriesColumn({ queries, orgSlug, websiteId }: QueriesColumnProps) {
  const [filter, setFilter] = useState("");
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);

  const filteredQueries = useMemo(() => {
    return queries.filter(q =>
      q.query.toLowerCase().includes(filter.toLowerCase()) ||
      (q.description?.toLowerCase() || "").includes(filter.toLowerCase())
    );
  }, [queries, filter]);

  const toggleQuery = (queryId: string) => {
    const newSelected = new Set(selectedQueries);
    if (newSelected.has(queryId)) {
      newSelected.delete(queryId);
    } else {
      newSelected.add(queryId);
    }
    setSelectedQueries(newSelected);
  };

  const toggleAll = () => {
    if (selectedQueries.size === filteredQueries.length) {
      setSelectedQueries(new Set());
    } else {
      setSelectedQueries(new Set(filteredQueries.map(q => q.id)));
    }
  };

  const analyzeSelected = async () => {
    if (selectedQueries.size === 0) return;
    
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/organizations/${orgSlug}/websites/${websiteId}/analyze-queries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queryIds: Array.from(selectedQueries),
        }),
      });

      if (!response.ok) {
        throw new Error("Échec de l'analyse");
      }

      // Réinitialiser la sélection
      setSelectedQueries(new Set());
      
      // Rafraîchir la page
      window.location.reload();
    } catch (error) {
      console.error("Failed to analyze queries:", error);
      alert("Erreur lors de l'analyse des requêtes");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Requêtes ({filteredQueries.length})
          </CardTitle>
          <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/queries`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Tout voir
            </Button>
          </Link>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrer..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        {selectedQueries.size > 0 && (
          <div className="flex items-center justify-between gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              {selectedQueries.size} sélectionnée{selectedQueries.size > 1 ? 's' : ''}
            </span>
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={analyzeSelected}
              disabled={analyzing}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${analyzing ? 'animate-spin' : ''}`} />
              {analyzing ? "Analyse..." : "Analyser"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredQueries.length > 0 && selectedQueries.size === filteredQueries.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="w-[50%]">Requête</TableHead>
                <TableHead className="text-center">Position</TableHead>
                <TableHead className="text-center w-15">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                    {filter ? "Aucun résultat" : "Aucune requête"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQueries.map((query) => {
                  const latestPosition = query.serpResults[0]?.position;
                  const trend = getTrend(query.serpResults);
                  return (
                    <TableRow key={query.id}>
                      <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedQueries.has(query.id)}
                          onCheckedChange={() => toggleQuery(query.id)}
                        />
                      </TableCell>
                      <TableCell 
                        className="py-2 cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/queries/${query.id}`}
                      >
                        <div className="text-xs font-medium truncate">{query.query}</div>
                        {query.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {query.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell 
                        className="text-center py-2 cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/queries/${query.id}`}
                      >
                        <span className="text-xs font-semibold">
                          {latestPosition !== null && latestPosition !== undefined && latestPosition > 0
                            ? `#${latestPosition}`
                            : query.serpResults.length > 0
                              ? <span className="text-orange-500">-</span>
                              : "-"}
                        </span>
                      </TableCell>
                      <TableCell 
                        className="text-center py-2 cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/queries/${query.id}`}
                      >
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
  );
}
