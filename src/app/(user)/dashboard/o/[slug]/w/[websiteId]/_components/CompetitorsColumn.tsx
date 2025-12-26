"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ArrowUpDown, Loader2, TrendingUp, TrendingDown, Minus, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface CompetitorScore {
  better: number;
  worse: number;
  total: number;
  netScore: number;
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  score: CompetitorScore;
  sitemapUrlCount?: number;
  lastSitemapFetch?: string;
}

interface CompetitorsColumnProps {
  orgSlug: string;
  websiteId: string;
}

const ITEMS_PER_PAGE = 50;

export function CompetitorsColumn({ orgSlug, websiteId }: CompetitorsColumnProps) {
  const [filter, setFilter] = useState("");
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<"score" | "name">("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filtrer les concurrents
  const filteredCompetitors = useMemo(() => {
    return competitors.filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [competitors, filter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredCompetitors.map((c) => c.id)));
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

  const allSelected = filteredCompetitors.length > 0 && selectedIds.size === filteredCompetitors.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredCompetitors.length;

  // Charger les concurrents
  const loadCompetitors = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/competitors?page=${pageNum}&limit=${ITEMS_PER_PAGE}&sortBy=${sortBy}&sortOrder=${sortOrder}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCompetitors(prev => reset ? data.data : [...prev, ...data.data]);
          setTotalCount(data.totalCount || 0);
          setHasMore(data.hasMore || false);
        }
      }
    } catch (err) {
      console.error("Failed to load competitors:", err);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, websiteId, loading, sortBy, sortOrder]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            loadCompetitors(nextPage);
            return nextPage;
          });
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadCompetitors]);

  // Charger au montage et quand le tri change
  useEffect(() => {
    setPage(1);
    setCompetitors([]);
    loadCompetitors(1, true);
  }, [sortBy, sortOrder]);

  const handleSortChange = (newSortBy: "score" | "name") => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
    } else {
      setSortBy(newSortBy);
      // Par défaut : asc pour score (négatifs en premier), desc pour nom (A-Z)
      setSortOrder(newSortBy === "score" ? "asc" : "desc");
    }
  };

  const renderScore = (score: CompetitorScore) => {
    if (score.total === 0) {
      return <span className="text-muted-foreground text-xs">-</span>;
    }

    const netScore = score.netScore;
    const isPositive = netScore > 0;
    const isNegative = netScore < 0;

    return (
      <div className="flex items-center gap-1 justify-center">
        <span className={`font-semibold text-sm ${
          isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-muted-foreground"
        }`}>
          {netScore > 0 ? "+" : ""}{netScore}
        </span>
        {isPositive && <TrendingUp className="w-3 h-3 text-green-600" />}
        {isNegative && <TrendingDown className="w-3 h-3 text-red-500" />}
        {!isPositive && !isNegative && <Minus className="w-3 h-3 text-muted-foreground" />}
      </div>
    );
  };

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Concurrents ({totalCount})
          </CardTitle>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button
                onClick={handleAnalyzeSitemaps}
                disabled={isAnalyzing}
                size="sm"
                variant="default"
                className="h-7 text-xs"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 mr-1" />
                    Analyser ({selectedIds.size})
                  </>
                )}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  Tri
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSortChange("score")}>
                  Par score {sortBy === "score" && `(${sortOrder === "desc" ? "↓" : "↑"})`}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("name")}>
                  Par nom {sortBy === "name" && `(${sortOrder === "desc" ? "↓" : "↑"})`}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/competitors`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Tout voir
              </Button>
            </Link>
          </div>
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
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto h-[calc(100vh-280px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className={someSelected ? "data-[state=checked]:bg-gray-400" : ""}
                  />
                </TableHead>
                <TableHead>Nom</TableHead>
                <TableHead className="text-center w-16">Score</TableHead>
                <TableHead className="text-center w-20">Sitemap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompetitors.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                    {filter ? "Aucun résultat" : "Aucun concurrent"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompetitors.map((competitor) => {
                  const isSelected = selectedIds.has(competitor.id);
                  return (
                    <TableRow
                      key={competitor.id}
                      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => window.location.href = `/dashboard/o/${orgSlug}/w/${websiteId}/competitors/${competitor.id}`}
                    >
                      <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleSelectCompetitor(competitor.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="text-xs font-medium">{competitor.name}</div>
                      </TableCell>
                      <TableCell className="py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {renderScore(competitor.score)}
                      </TableCell>
                      <TableCell className="py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        {competitor.sitemapUrlCount !== undefined ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {competitor.sitemapUrlCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Infinite scroll trigger */}
          {hasMore && <div ref={loadMoreRef} className="h-4" />}
        </div>
      </CardContent>
    </Card>
  );
}
