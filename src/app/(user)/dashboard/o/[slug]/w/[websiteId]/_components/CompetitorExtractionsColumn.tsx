"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, ExternalLink, Download, Sparkles, Loader2, MoreVertical, CheckCircle2, Circle, XCircle, RefreshCw, Search, Trash2 } from "lucide-react";

interface SearchQuery {
  id: string;
  query: string;
}

interface CompetitorExtraction {
  id: string;
  searchQueryId: string;
  url: string;
  position: number | null;
  status: string;
  type: string | null;
  title: string | null;
  extractedAt: string | null;
  searchQuery: SearchQuery;
  keywords?: Array<{
    keyword: string;
    score: number;
  }> | null;
}

interface CompetitorExtractionsColumnProps {
  websiteId: string;
  orgSlug: string;
}

const ITEMS_PER_PAGE = 50;

export function CompetitorExtractionsColumn({ websiteId, orgSlug }: CompetitorExtractionsColumnProps) {
  const [extractions, setExtractions] = useState<CompetitorExtraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filtres
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const [selectedExtractions, setSelectedExtractions] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Charger les extractions
  const loadExtractions = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      });
      
      const response = await fetch(`/api/websites/${websiteId}/competitor-extractions-all?${params}`);
      if (response.ok) {
        const data = await response.json();
        setExtractions(prev => reset ? data.extractions : [...prev, ...data.extractions]);
        setTotalCount(data.totalCount || data.extractions.length);
        setHasMore(data.hasMore !== undefined ? data.hasMore : data.extractions.length === ITEMS_PER_PAGE);
      }
    } catch (error) {
      console.error("Erreur de chargement:", error);
    } finally {
      setLoading(false);
    }
  }, [websiteId, loading, statusFilter, typeFilter]);

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            loadExtractions(nextPage);
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
  }, [hasMore, loading, loadExtractions]);

  // Charger au montage et quand les filtres changent
  useEffect(() => {
    setPage(1);
    setExtractions([]);
    loadExtractions(1, true);
  }, [statusFilter, typeFilter]);

  // Auto-refresh pour les extractions en cours
  useEffect(() => {
    const hasInProgress = extractions.some(e => e.status === "pending" || e.status === "extracting");
    if (!hasInProgress) return;
    
    const interval = setInterval(() => {
      loadExtractions(1, true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [extractions, loadExtractions]);

  const filteredExtractions = useMemo(() => {
    return extractions.filter(e => {
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesUrl = e.url.toLowerCase().includes(search);
        const matchesTitle = e.title?.toLowerCase().includes(search);
        const matchesQuery = e.searchQuery.query.toLowerCase().includes(search);
        if (!matchesUrl && !matchesTitle && !matchesQuery) {
          return false;
        }
      }
      return true;
    });
  }, [extractions, searchFilter]);

  const inProgressCount = extractions.filter(e => e.status === "pending" || e.status === "extracting").length;

  const toggleExtraction = (extractionId: string) => {
    const newSelected = new Set(selectedExtractions);
    if (newSelected.has(extractionId)) {
      newSelected.delete(extractionId);
    } else {
      newSelected.add(extractionId);
    }
    setSelectedExtractions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedExtractions(new Set(filteredExtractions.map(e => e.id)));
    } else {
      setSelectedExtractions(new Set());
    }
  };

  const allSelected = filteredExtractions.length > 0 && selectedExtractions.size === filteredExtractions.length;
  const someSelected = selectedExtractions.size > 0 && selectedExtractions.size < filteredExtractions.length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case "extracting":
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case "pending":
        return <Circle className="w-3 h-3 text-gray-400" />;
      case "failed":
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Circle className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Terminé";
      case "extracting": return "En cours";
      case "pending": return "En attente";
      case "failed": return "Échec";
      default: return status;
    }
  };

  const deleteSelected = async () => {
    if (selectedExtractions.size === 0) return;
    
    if (!confirm(`Voulez-vous vraiment supprimer ${selectedExtractions.size} extraction${selectedExtractions.size > 1 ? 's' : ''} ?`)) {
      return;
    }
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/organizations/${orgSlug}/websites/${websiteId}/competitor-extractions`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extractionIds: Array.from(selectedExtractions),
        }),
      });

      if (!response.ok) {
        throw new Error("Échec de la suppression");
      }

      // Réinitialiser la sélection
      setSelectedExtractions(new Set());
      
      // Recharger les extractions
      setPage(1);
      loadExtractions(1, true);
    } catch (error) {
      console.error("Failed to delete extractions:", error);
      alert("Erreur lors de la suppression des extractions");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="h-[calc(100vh-8rem)] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Extractions concurrentes
            <span className="text-xs font-normal text-muted-foreground">
              ({totalCount})
            </span>
          </CardTitle>
          {inProgressCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {inProgressCount} en cours
            </div>
          )}
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="extracting">En cours</SelectItem>
              <SelectItem value="failed">Échec</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="quick">Rapide</SelectItem>
              <SelectItem value="full">Complet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions sélection */}
        {selectedExtractions.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedExtractions.size} sélectionné{selectedExtractions.size > 1 ? "s" : ""}
            </span>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="w-3 h-3 mr-1" />
              Exporter
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8"
              onClick={deleteSelected}
              disabled={deleting}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {deleting ? "Suppression..." : "Supprimer"}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {loading && page === 1 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredExtractions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-sm text-muted-foreground">Aucune extraction</p>
          </div>
        ) : (
          <div className="overflow-auto h-[calc(100vh-340px)]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => el && (el.indeterminate = someSelected)}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead className="w-20">Statut</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExtractions.map((extraction) => {
                  const topKeywords = extraction.keywords?.slice(0, 3);
                  return (
                    <TableRow key={extraction.id} className="text-xs">
                      <TableCell>
                        <Checkbox
                          checked={selectedExtractions.has(extraction.id)}
                          onCheckedChange={() => toggleExtraction(extraction.id)}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="max-w-[280px]">
                          <div className="flex items-center gap-1">
                            {extraction.position && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-secondary shrink-0 font-medium">
                                #{extraction.position}
                              </span>
                            )}
                            <Link
                              href={`/dashboard/o/${orgSlug}/w/${websiteId}/queries/${extraction.searchQueryId}`}
                              className="text-xs font-medium hover:underline truncate"
                            >
                              {extraction.searchQuery.query}
                            </Link>
                          </div>
                          {extraction.title && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {extraction.title}
                            </p>
                          )}
                          <a
                            href={extraction.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                          >
                            {new URL(extraction.url).hostname}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {extraction.type === "full" && topKeywords && topKeywords.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-0.5">
                              {topKeywords.map((kw, i) => (
                                <span key={i} className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">
                                  {kw.keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(extraction.status)}
                          <span className="text-xs">{getStatusLabel(extraction.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/o/${orgSlug}/w/${websiteId}/queries/${extraction.searchQueryId}`}>
                                Voir la requête
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={extraction.url} target="_blank" rel="noopener noreferrer">
                                Ouvrir la page
                              </a>
                            </DropdownMenuItem>
                            {extraction.status === "completed" && extraction.type === "quick" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  Extraction complète
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Infinite scroll trigger */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex items-center justify-center p-4"
              >
                {loading && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
