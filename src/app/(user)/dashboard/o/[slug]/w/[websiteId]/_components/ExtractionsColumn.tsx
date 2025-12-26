"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  Search,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Zap,
  Layers,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface PageExtraction {
  id: string;
  url: string;
  source: string;
  type: "quick" | "full" | null;
  status: "pending" | "extracting" | "completed" | "failed";
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  createdAt: string;
  extractedAt: string | null;
  error: string | null;
}

interface ExtractionsColumnProps {
  websiteId: string;
}

const ITEMS_PER_PAGE = 50;

export function ExtractionsColumn({
  websiteId,
}: ExtractionsColumnProps) {
  const [extractions, setExtractions] = useState<PageExtraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filtres
  const [searchFilter, setSearchFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Sélection
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filtrer les extractions côté client pour la recherche
  const filteredExtractions = useMemo(() => {
    return extractions.filter((ext) => {
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesUrl = ext.url.toLowerCase().includes(search);
        const matchesTitle = ext.title?.toLowerCase().includes(search);
        const matchesMeta = ext.metaDescription?.toLowerCase().includes(search);
        const matchesH1 = ext.h1.some((h) => h.toLowerCase().includes(search));
        if (!matchesUrl && !matchesTitle && !matchesMeta && !matchesH1) {
          return false;
        }
      }
      return true;
    });
  }, [extractions, searchFilter]);

  // Charger les extractions
  const loadExtractions = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (loading) return;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: ITEMS_PER_PAGE.toString(),
        });

        if (typeFilter !== "all") {
          params.set("type", typeFilter);
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const response = await fetch(
          `/api/websites/${websiteId}/extractions?${params}`
        );

        if (response.ok) {
          const data = await response.json();
          setExtractions((prev) =>
            reset ? data.data.extractions : [...prev, ...data.data.extractions]
          );
          setTotalCount(data.data.totalCount || 0);
          setHasMore(data.data.hasMore || false);
        }
      } catch (err) {
        console.error("Failed to load extractions:", err);
      } finally {
        setLoading(false);
      }
    },
    [websiteId, typeFilter, statusFilter, loading]
  );

  // Lancer une extraction
  const handleExtract = async (
    urls: string[],
    type: "quick" | "full"
  ) => {
    if (urls.length === 0) return;

    setExtracting(true);
    try {
      const response = await fetch(`/api/websites/${websiteId}/extractions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          type,
          source: "manual",
        }),
      });

      if (response.ok) {
        // Recharger les données
        setPage(1);
        setExtractions([]);
        setSelectedUrls(new Set());
        await loadExtractions(1, true);
      }
    } catch (err) {
      console.error("Failed to start extraction:", err);
    } finally {
      setExtracting(false);
    }
  };

  // Extraire toutes les URLs sélectionnées
  const handleExtractSelected = (type: "quick" | "full") => {
    const urls = Array.from(selectedUrls);
    handleExtract(urls, type);
  };

  // Toggle sélection
  const toggleSelection = (url: string) => {
    setSelectedUrls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  // Sélectionner/désélectionner tout
  const toggleSelectAll = () => {
    if (selectedUrls.size === filteredExtractions.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredExtractions.map((e) => e.url)));
    }
  };

  // Infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadExtractions(nextPage);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, page, loadExtractions]);

  // Chargement initial et rechargement sur changement de filtres
  useEffect(() => {
    setPage(1);
    setExtractions([]);
    loadExtractions(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  // Badge de statut
  const StatusBadge = ({ status }: { status: PageExtraction["status"] }) => {
    const icons = {
      pending: <Circle className="w-3 h-3 text-gray-400" />,
      extracting: <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />,
      completed: <CheckCircle2 className="w-3 h-3 text-green-500" />,
      failed: <XCircle className="w-3 h-3 text-red-500" />,
    };
    return icons[status];
  };

  // Badge de type
  const TypeBadge = ({ type }: { type: PageExtraction["type"] }) => {
    if (!type)
      return <span className="text-xs text-gray-400 italic">Non extrait</span>;
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
          type === "quick"
            ? "bg-blue-100 text-blue-700"
            : "bg-purple-100 text-purple-700"
        }`}
      >
        {type === "quick" ? (
          <>
            <Zap className="w-3 h-3" />
            Rapide
          </>
        ) : (
          <>
            <Layers className="w-3 h-3" />
            Complet
          </>
        )}
      </span>
    );
  };

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Extractions ({totalCount})
          </CardTitle>
          <div className="flex gap-1">
            {selectedUrls.size > 0 && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtractSelected("quick")}
                  disabled={extracting}
                  className="text-xs"
                >
                  {extracting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3 mr-1" />
                  )}
                  Rapide ({selectedUrls.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtractSelected("full")}
                  disabled={extracting}
                  className="text-xs"
                >
                  {extracting ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Layers className="w-3 h-3 mr-1" />
                  )}
                  Complet ({selectedUrls.size})
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2">
        {/* Filtres */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher dans les pages..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="null">Non extrait</SelectItem>
                <SelectItem value="quick">Rapide</SelectItem>
                <SelectItem value="full">Complet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="extracting">En cours</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="failed">Échec</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-auto h-[calc(100vh-340px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={
                      selectedUrls.size > 0 &&
                      selectedUrls.size === filteredExtractions.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-8">État</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-32">Titre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExtractions.map((extraction) => (
                <TableRow key={extraction.id} className="text-xs">
                  <TableCell>
                    <Checkbox
                      checked={selectedUrls.has(extraction.url)}
                      onCheckedChange={() => toggleSelection(extraction.url)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={extraction.status} />
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={extraction.type} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={extraction.url}>
                    {new URL(extraction.url).pathname}
                  </TableCell>
                  <TableCell
                    className="max-w-[150px] truncate"
                    title={extraction.title || undefined}
                  >
                    {extraction.title || (
                      <span className="text-gray-400 italic">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    <Loader2 className="w-4 h-4 mx-auto animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredExtractions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune extraction trouvée
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {hasMore && <div ref={loadMoreRef} className="h-10" />}
        </div>
      </CardContent>
    </Card>
  );
}
