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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, TrendingUp, TrendingDown, Minus, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Snapshot {
  id: string;
  sitemapUrl: string;
  urlCount: number;
  fetchedAt: string;
  sitemapType: string;
}

interface SitemapDiff {
  added: string[];
  removed: string[];
  unchanged: number;
}

interface SitemapDiffViewerProps {
  isOpen: boolean;
  onClose: () => void;
  orgSlug: string;
  websiteId: string;
}

export function SitemapDiffViewer({
  isOpen,
  onClose,
  orgSlug,
  websiteId,
}: SitemapDiffViewerProps) {
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [snapshot1Id, setSnapshot1Id] = useState<string>("");
  const [snapshot2Id, setSnapshot2Id] = useState<string>("");
  const [diff, setDiff] = useState<SitemapDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Charger l'historique des snapshots
  useEffect(() => {
    if (!isOpen) return;

    const loadSnapshots = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap/history`
        );
        
        if (response.ok) {
          const data = await response.json();
          setSnapshots(data.snapshots || []);
          
          // Sélectionner automatiquement les 2 derniers
          if (data.snapshots.length >= 2) {
            setSnapshot1Id(data.snapshots[0].id);
            setSnapshot2Id(data.snapshots[1].id);
          }
        }
      } catch (err) {
        console.error("Failed to load snapshots:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSnapshots();
  }, [isOpen, orgSlug, websiteId]);

  // Calculer le diff
  const calculateDiff = async () => {
    if (!snapshot1Id || !snapshot2Id) return;

    setDiffLoading(true);
    try {
      // Fetch les deux snapshots
      const [snap1Response, snap2Response] = await Promise.all([
        fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap?snapshotId=${snapshot1Id}`
        ),
        fetch(
          `/api/organizations/${orgSlug}/websites/${websiteId}/sitemap?snapshotId=${snapshot2Id}`
        ),
      ]);

      if (!snap1Response.ok || !snap2Response.ok) {
        throw new Error("Failed to fetch snapshots");
      }

      const snap1Data = await snap1Response.json();
      const snap2Data = await snap2Response.json();

      const urls1 = new Set(snap1Data.urls.map((u: any) => u.url));
      const urls2 = new Set(snap2Data.urls.map((u: any) => u.url));

      const added: string[] = [];
      const removed: string[] = [];

      // URLs ajoutées (dans snap1 mais pas dans snap2)
      urls1.forEach((url) => {
        if (!urls2.has(url)) {
          added.push(url);
        }
      });

      // URLs supprimées (dans snap2 mais pas dans snap1)
      urls2.forEach((url) => {
        if (!urls1.has(url)) {
          removed.push(url);
        }
      });

      const unchanged = urls1.size - added.length;

      setDiff({ added, removed, unchanged });
    } catch (err) {
      console.error("Failed to calculate diff:", err);
    } finally {
      setDiffLoading(false);
    }
  };

  useEffect(() => {
    if (snapshot1Id && snapshot2Id) {
      calculateDiff();
    }
  }, [snapshot1Id, snapshot2Id]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Comparer les versions du sitemap</DialogTitle>
          <DialogDescription>
            Visualisez les différences entre deux analyses de sitemap
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sélection des snapshots */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Version récente</label>
                <Select value={snapshot1Id} onValueChange={setSnapshot1Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={snapshot.id}>
                        {new Date(snapshot.fetchedAt).toLocaleDateString("fr-FR")} -{" "}
                        {snapshot.urlCount} URLs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Version ancienne</label>
                <Select value={snapshot2Id} onValueChange={setSnapshot2Id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.map((snapshot) => (
                      <SelectItem key={snapshot.id} value={snapshot.id}>
                        {new Date(snapshot.fetchedAt).toLocaleDateString("fr-FR")} -{" "}
                        {snapshot.urlCount} URLs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats */}
            {diff && !diffLoading && (
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold text-green-500">
                          {diff.added.length}
                        </p>
                        <p className="text-xs text-muted-foreground">Ajoutées</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold text-red-500">
                          {diff.removed.length}
                        </p>
                        <p className="text-xs text-muted-foreground">Supprimées</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Minus className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{diff.unchanged}</p>
                        <p className="text-xs text-muted-foreground">Inchangées</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Liste des différences */}
            {diffLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : diff ? (
              <ScrollArea className="h-[400px] border rounded-md p-4">
                <div className="space-y-4">
                  {/* URLs ajoutées */}
                  {diff.added.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        URLs Ajoutées ({diff.added.length})
                      </h3>
                      <div className="space-y-1">
                        {diff.added.map((url, index) => (
                          <div
                            key={`added-${index}`}
                            className="text-xs font-mono bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 p-2 rounded"
                          >
                            + {new URL(url).pathname}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* URLs supprimées */}
                  {diff.removed.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        URLs Supprimées ({diff.removed.length})
                      </h3>
                      <div className="space-y-1">
                        {diff.removed.map((url, index) => (
                          <div
                            key={`removed-${index}`}
                            className="text-xs font-mono bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-2 rounded"
                          >
                            - {new URL(url).pathname}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {diff.added.length === 0 && diff.removed.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Aucune différence détectée entre ces deux versions
                    </p>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sélectionnez deux versions pour voir les différences
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
