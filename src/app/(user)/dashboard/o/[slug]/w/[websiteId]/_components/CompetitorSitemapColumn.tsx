"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Search, Loader2, RefreshCw, Globe, History, BarChart3 } from "lucide-react";

interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

interface CompetitorSitemapColumnProps {
  orgSlug: string;
  websiteId: string;
  competitorId: string;
  competitorName: string;
  competitorUrl: string;
}

const ITEMS_PER_PAGE = 50;

export function CompetitorSitemapColumn({
  orgSlug,
  websiteId,
  competitorId,
  competitorName,
  competitorUrl,
}: CompetitorSitemapColumnProps) {
  const [filter, setFilter] = useState("");
  const [urls, setUrls] = useState<SitemapUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [sitemapUrl, setSitemapUrl] = useState<string | null>(null);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filtrer les URLs
  const filteredUrls = urls.filter((u) =>
    u?.url?.toLowerCase().includes(filter.toLowerCase())
  );

  // Charger les URLs du sitemap
  const loadUrls = useCallback(
    async (pageNum: number, reset: boolean = false) => {
      if (loading) return;

      setLoading(true);
      try {
        const response = await fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/competitors/${competitorId}/sitemap?page=${pageNum}&limit=${ITEMS_PER_PAGE}`
        );

        if (response.ok) {
          const data = await response.json();
          console.log('[CompetitorSitemap] API Response:', data);
          if (data.success) {
            const newUrls = data.data.urls || [];
            console.log('[CompetitorSitemap] URLs received:', newUrls.length);
            setUrls((prev) => (reset ? newUrls : [...prev, ...newUrls]));
            setTotalCount(data.data.pagination.total);
            setHasMore(data.data.pagination.hasMore);
            setFetchedAt(data.data.snapshot.fetchedAt);
            setSitemapUrl(data.data.snapshot.sitemapUrl);
          }
        } else if (response.status === 404) {
          // Pas encore de sitemap
          console.log('[CompetitorSitemap] No sitemap found (404)');
          setUrls([]);
          setTotalCount(0);
          setHasMore(false);
        } else {
          const errorData = await response.json();
          console.error('[CompetitorSitemap] API Error:', response.status, errorData);
        }
      } catch (err) {
        console.error("Failed to load competitor sitemap:", err);
      } finally {
        setLoading(false);
      }
    },
    [orgSlug, websiteId, competitorId]
  );

  // Analyser le sitemap du concurrent
  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/competitors/${competitorId}/sitemap/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedSitemaps: [] }),
        }
      );

      if (response.ok) {
        // Recharger après quelques secondes
        setTimeout(() => {
          setPage(1);
          setUrls([]);
          loadUrls(1, true);
        }, 3000);
      }
    } catch (err) {
      console.error("Failed to analyze competitor sitemap:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => {
            const nextPage = prev + 1;
            loadUrls(nextPage);
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
  }, [hasMore, loading, loadUrls]);

  // Charger au montage
  useEffect(() => {
    loadUrls(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="h-[calc(100vh-180px)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Sitemap - {competitorName}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => loadUrls(1, true)}
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrer les URLs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <span>{totalCount.toLocaleString()} URLs</span>
            </div>
            {fetchedAt && (
              <div className="flex items-center gap-1">
                <History className="w-3 h-3" />
                <span>
                  {new Date(fetchedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {urls.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-sm font-medium mb-2">Aucun sitemap analysé</h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Lancez une analyse du sitemap pour voir les pages du concurrent.
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing}
              size="sm"
              variant="default"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Analyser le sitemap
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="overflow-auto h-[calc(100vh-340px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-32 text-center">Dernière modif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUrls.map((url, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="py-1.5">
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs hover:underline text-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </a>
                    </TableCell>
                    <TableCell className="py-1.5 text-center text-xs text-muted-foreground">
                      {url.lastmod
                        ? new Date(url.lastmod).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMore && <div ref={loadMoreRef} className="h-4" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
