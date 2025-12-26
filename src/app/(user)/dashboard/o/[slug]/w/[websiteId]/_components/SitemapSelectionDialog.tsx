"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Globe, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SitemapIndex {
  loc: string;
  lastmod?: string;
}

interface SitemapSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedUrls: string[]) => void;
  websiteUrl: string;
  orgSlug: string;
  websiteId: string;
}

export function SitemapSelectionDialog({
  isOpen,
  onClose,
  onConfirm,
  websiteUrl,
  orgSlug,
  websiteId,
}: SitemapSelectionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sitemapIndexes, setSitemapIndexes] = useState<SitemapIndex[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSitemapIndex, setIsSitemapIndex] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Détecter si c'est un sitemap index via l'API (utilise BrightData)
  useEffect(() => {
    if (!isOpen) {
      // Reset state quand le dialog se ferme
      setSitemapIndexes([]);
      setSelectedUrls(new Set());
      setIsSitemapIndex(false);
      setError(null);
      return;
    }

    const detectSitemapType = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap/detect`
        );
        
        if (!response.ok) {
          const data = await response.json();
          setError(data.error || "Impossible de détecter le sitemap");
          setIsSitemapIndex(false);
          setSitemapIndexes([]);
          return;
        }

        const data = await response.json();
        
        if (data.type === "index") {
          setIsSitemapIndex(true);
          setSitemapIndexes(data.sitemaps || []);
          // Sélectionner tous par défaut
          setSelectedUrls(new Set(data.sitemaps.map((s: SitemapIndex) => s.loc)));
        } else if (data.type === "single") {
          setIsSitemapIndex(false);
          setSitemapIndexes([]);
        } else {
          setError("Aucun sitemap trouvé");
          setIsSitemapIndex(false);
          setSitemapIndexes([]);
        }
      } catch (err: any) {
        console.error("Failed to detect sitemap:", err);
        setError(err.message || "Erreur lors de la détection");
        setIsSitemapIndex(false);
        setSitemapIndexes([]);
      } finally {
        setLoading(false);
      }
    };

    detectSitemapType();
  }, [isOpen, orgSlug, websiteId]);

  const toggleSelection = (url: string) => {
    const newSelected = new Set(selectedUrls);
    if (newSelected.has(url)) {
      newSelected.delete(url);
    } else {
      newSelected.add(url);
    }
    setSelectedUrls(newSelected);
  };

  const toggleAll = () => {
    if (selectedUrls.size === sitemapIndexes.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(sitemapIndexes.map(s => s.loc)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedUrls));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sélectionner les sitemaps à analyser</DialogTitle>
          <DialogDescription>
            {loading
              ? "Détection du type de sitemap..."
              : isSitemapIndex
              ? "Ce site utilise un sitemap index. Sélectionnez les sous-sitemaps à analyser."
              : "Ce site utilise un sitemap simple. Tous les URLs seront analysés."
            }
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Globe className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-sm text-red-500 mb-2">{error}</p>
            <p className="text-xs text-muted-foreground">
              L&apos;analyse essaiera quand même de détecter le sitemap automatiquement.
            </p>
          </div>
        ) : isSitemapIndex ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedUrls.size} sur {sitemapIndexes.length} sélectionné(s)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
              >
                {selectedUrls.size === sitemapIndexes.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
            </div>
            
            <ScrollArea className="h-[400px] border rounded-md p-4">
              <div className="space-y-3">
                {sitemapIndexes.map((sitemap, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleSelection(sitemap.loc)}
                  >
                    <Checkbox
                      checked={selectedUrls.has(sitemap.loc)}
                      onCheckedChange={() => toggleSelection(sitemap.loc)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-mono break-all">{sitemap.loc}</p>
                      </div>
                      {sitemap.lastmod && (
                        <p className="text-xs text-muted-foreground">
                          Dernière modification : {new Date(sitemap.lastmod).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    {selectedUrls.has(sitemap.loc) && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Globe className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              Sitemap simple détecté. L&apos;analyse récupérera toutes les URLs automatiquement.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (isSitemapIndex && selectedUrls.size === 0)}
          >
            Lancer l&apos;analyse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
