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
import { Search, Loader2, RefreshCw, CheckCircle2, Circle, Globe, History } from "lucide-react";
import { SitemapSelectionDialog } from "./SitemapSelectionDialog";
import { SitemapDiffViewer } from "./SitemapDiffViewer";

interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  isAnalyzed?: boolean;
  lastAnalyzed?: string;
}

interface SitemapColumnProps {
  orgSlug: string;
  websiteId: string;
  websiteUrl: string;
}

const ITEMS_PER_PAGE = 50;

export function SitemapColumn({ orgSlug, websiteId, websiteUrl }: SitemapColumnProps) {
  const [filter, setFilter] = useState("");
  const [urls, setUrls] = useState<SitemapUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filtrer les URLs
  const filteredUrls = useMemo(() => {
    return urls.filter(u =>
      u.url.toLowerCase().includes(filter.toLowerCase())
    );
  }, [urls, filter]);

  // Charger les URLs
  const loadUrls = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap?page=${pageNum}&limit=${ITEMS_PER_PAGE}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setUrls(prev => reset ? data.urls : [...prev, ...data.urls]);
        setTotalCount(data.totalCount || 0);
        setLastFetch(data.lastFetch);
        setHasMore(data.hasMore || false);
      }
    } catch (err) {
      console.error("Failed to load sitemap URLs:", err);
    } finally {
      setLoading(false);
    }
  }, [orgSlug, websiteId, loading]);

  // Lancer l'analyse du sitemap
  const handleAnalyze = () => {
    setShowSelectionDialog(true);
  };

  const handleConfirmAnalyze = async (selectedUrls: string[]) => {
    setAnalyzing(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap/analyze`,
        { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedSitemaps: selectedUrls }),
        }
      );
      
      if (response.ok) {
        // Recharger les données
        setPage(1);
        setUrls([]);
        await loadUrls(1, true);
      }
    } catch (err) {
      console.error("Failed to analyze sitemap:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          loadUrls(nextPage);
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
  }, [hasMore, loading, page, loadUrls]);

  // Chargement initial
  useEffect(() => {
    loadUrls(1, true);
  }, []);

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Sitemap ({totalCount})
          </CardTitle>
          <div className="flex gap-1">
            {totalCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowDiffViewer(true)}
              >
                <History className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Analyse...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Analyser
                </>
              )}
            </Button>
          </div>
        </div>
        {lastFetch && (
          <p className="text-xs text-muted-foreground">
            Dernière analyse : {new Date(lastFetch).toLocaleDateString("fr-FR")}
          </p>
        )}
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrer les URLs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto h-[calc(100vh-320px)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Statut</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="text-center w-[100px]">Priorité</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUrls.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Globe className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {urls.length === 0 
                        ? "Aucun sitemap analysé"
                        : "Aucune URL trouvée"
                      }
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUrls.map((urlData, index) => {
                  const urlPath = new URL(urlData.url).pathname;
                  return (
                    <TableRow
                      key={`${urlData.url}-${index}`}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        {urlData.isAnalyzed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono truncate max-w-[300px]">
                        {urlPath}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {urlData.priority ? urlData.priority.toFixed(1) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          
          {/* Infinite scroll trigger */}
          {hasMore && (
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>

      <SitemapSelectionDialog
        isOpen={showSelectionDialog}
        onClose={() => setShowSelectionDialog(false)}
        onConfirm={handleConfirmAnalyze}
        websiteUrl={websiteUrl}
        orgSlug={orgSlug}
        websiteId={websiteId}
      />

      <SitemapDiffViewer
        isOpen={showDiffViewer}
        onClose={() => setShowDiffViewer(false)}
        orgSlug={orgSlug}
        websiteId={websiteId}
      />
    </Card>
  );
}
