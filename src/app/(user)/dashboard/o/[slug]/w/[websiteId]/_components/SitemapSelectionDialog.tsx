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
}

export function SitemapSelectionDialog({
  isOpen,
  onClose,
  onConfirm,
  websiteUrl,
}: SitemapSelectionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sitemapIndexes, setSitemapIndexes] = useState<SitemapIndex[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSitemapIndex, setIsSitemapIndex] = useState(false);

  // Détecter si c'est un sitemap index
  useEffect(() => {
    if (!isOpen) return;

    const detectSitemapType = async () => {
      setLoading(true);
      try {
        // Essayer de récupérer le sitemap principal
        const standardUrls = [
          `${websiteUrl}/sitemap.xml`,
          `${websiteUrl}/sitemap_index.xml`,
          `${websiteUrl}/sitemap-index.xml`,
        ];

        for (const url of standardUrls) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const text = await response.text();
              
              // Vérifier si c'est un sitemap index
              if (text.includes("<sitemapindex")) {
                setIsSitemapIndex(true);
                
                // Parser les sitemaps du index
                const locRegex = /<loc>(.*?)<\/loc>/g;
                const lastmodRegex = /<lastmod>(.*?)<\/lastmod>/g;
                
                const locs: string[] = [];
                let match;
                while ((match = locRegex.exec(text)) !== null) {
                  locs.push(match[1]);
                }
                
                const lastmods: string[] = [];
                while ((match = lastmodRegex.exec(text)) !== null) {
                  lastmods.push(match[1]);
                }
                
                const indexes = locs.map((loc, i) => ({
                  loc,
                  lastmod: lastmods[i],
                }));
                
                setSitemapIndexes(indexes);
                // Sélectionner tous par défaut
                setSelectedUrls(new Set(indexes.map(s => s.loc)));
                break;
              } else {
                // Sitemap simple
                setIsSitemapIndex(false);
                setSitemapIndexes([]);
                break;
              }
            }
          } catch (err) {
            // Continuer avec l'URL suivante
            continue;
          }
        }
      } catch (err) {
        console.error("Failed to detect sitemap type:", err);
      } finally {
        setLoading(false);
      }
    };

    detectSitemapType();
  }, [isOpen, websiteUrl]);

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
            disabled={isSitemapIndex && selectedUrls.size === 0}
          >
            Lancer l&apos;analyse
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
