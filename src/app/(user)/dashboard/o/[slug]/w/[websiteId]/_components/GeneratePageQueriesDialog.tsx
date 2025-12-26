"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

interface GeneratedQuery {
  query: string;
  intent: string;
  competition: string;
  relevance: number;
}

interface GeneratePageQueriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUrls: string[];
  websiteId: string;
}

export function GeneratePageQueriesDialog({
  isOpen,
  onClose,
  selectedUrls,
  websiteId,
}: GeneratePageQueriesDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [intentType, setIntentType] = useState<string>("all");
  const [competitionLevel, setCompetitionLevel] = useState<string>("all");
  const [queries, setQueries] = useState<GeneratedQuery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedQueries, setSelectedQueries] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setQueries([]);

    try {
      const response = await fetch(
        `/api/websites/${websiteId}/extractions/generate-queries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: selectedUrls,
            intentType,
            competitionLevel,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setQueries(data.queries || []);
      } else {
        setError(data.error || "Erreur lors de la génération");
      }
    } catch (err) {
      console.error("Failed to generate queries:", err);
      setError("Erreur de connexion");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setQueries([]);
    setError(null);
    setSelectedQueries(new Set());
    setAddSuccess(false);
  };

  const handleToggleQuery = (query: string) => {
    setSelectedQueries((prev) => {
      const next = new Set(prev);
      if (next.has(query)) {
        next.delete(query);
      } else {
        next.add(query);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedQueries.size === queries.length) {
      setSelectedQueries(new Set());
    } else {
      setSelectedQueries(new Set(queries.map((q) => q.query)));
    }
  };

  const handleAddToTracking = async () => {
    if (selectedQueries.size === 0) return;

    setAdding(true);
    try {
      const selectedQueriesData = queries.filter((q) =>
        selectedQueries.has(q.query)
      );

      const response = await fetch(`/api/websites/${websiteId}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queries: selectedQueriesData.map((q) => ({
            query: q.query,
            competitionLevel: q.competition.toUpperCase(),
            confidence: q.relevance / 10,
            tags: [q.intent],
          })),
        }),
      });

      if (response.ok) {
        setAddSuccess(true);
        setSelectedQueries(new Set());
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Erreur lors de l'ajout");
      }
    } catch (err) {
      console.error("Failed to add queries:", err);
      setError("Erreur de connexion");
    } finally {
      setAdding(false);
    }
  };

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case "informational":
        return "Info";
      case "commercial":
        return "Comm";
      case "navigational":
        return "Nav";
      case "transactional":
        return "Trans";
      default:
        return intent;
    }
  };

  const getIntentColor = (intent: string) => {
    switch (intent) {
      case "informational":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
      case "commercial":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "navigational":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      case "transactional":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getCompetitionColor = (competition: string) => {
    switch (competition) {
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-175 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Générer des requêtes SEO
          </DialogTitle>
          <DialogDescription>
            {queries.length === 0
              ? `Utilisez l'IA pour identifier les requêtes de recherche potentielles pour les ${selectedUrls.length} page(s) sélectionnée(s).`
              : `${queries.length} requête(s) générée(s) pour ${selectedUrls.length} page(s).`}
          </DialogDescription>
        </DialogHeader>

        {queries.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="intent">Type d&apos;intention</Label>
              <Select value={intentType} onValueChange={setIntentType}>
                <SelectTrigger id="intent">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="informational">
                    Informationnelles (recherche d&apos;info)
                  </SelectItem>
                  <SelectItem value="commercial">
                    Commerciales (intention d&apos;achat)
                  </SelectItem>
                  <SelectItem value="navigational">
                    Navigationnelles (trouver un site)
                  </SelectItem>
                  <SelectItem value="transactional">
                    Transactionnelles (action immédiate)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filtrez par type d&apos;intention de recherche
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competition">Niveau de concurrence</Label>
              <Select
                value={competitionLevel}
                onValueChange={setCompetitionLevel}
              >
                <SelectTrigger id="competition">
                  <SelectValue placeholder="Sélectionner un niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous niveaux</SelectItem>
                  <SelectItem value="low">
                    Faible (longue traîne, niches)
                  </SelectItem>
                  <SelectItem value="medium">
                    Moyen (opportunités équilibrées)
                  </SelectItem>
                  <SelectItem value="high">
                    Élevé (requêtes génériques)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Ciblez des requêtes selon leur niveau de compétition
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                💡 L&apos;IA analysera le contenu extrait (titre, meta,
                headings, keywords) pour suggérer des requêtes pertinentes
                selon vos critères.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-900 dark:text-red-100">
                  {error}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {!addSuccess ? (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 flex items-start gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    Génération terminée ! Sélectionnez les requêtes à ajouter
                    au suivi.
                  </p>
                  {selectedQueries.size > 0 && (
                    <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                      {selectedQueries.size} requête(s) sélectionnée(s)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 flex items-start gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-900 dark:text-green-100">
                  ✅ Requêtes ajoutées avec succès ! Rechargement...
                </p>
              </div>
            )}

            <ScrollArea className="h-100 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedQueries.size > 0 &&
                          selectedQueries.size === queries.length
                        }
                        onCheckedChange={handleToggleAll}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Requête</TableHead>
                    <TableHead className="w-25">Intention</TableHead>
                    <TableHead className="w-30">Concurrence</TableHead>
                    <TableHead className="w-25 text-center">
                      Pertinence
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((q, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Checkbox
                          checked={selectedQueries.has(q.query)}
                          onCheckedChange={() => handleToggleQuery(q.query)}
                          aria-label={`Sélectionner ${q.query}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{q.query}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getIntentColor(q.intent)}`}
                        >
                          {getIntentLabel(q.intent)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCompetitionColor(q.competition)}`}
                        >
                          {q.competition === "low"
                            ? "Faible"
                            : q.competition === "medium"
                              ? "Moyen"
                              : "Élevé"}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{q.relevance}/10</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {queries.length === 0 ? (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={generating}
              >
                Annuler
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Générer
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleReset}>
                Nouvelle génération
              </Button>
              <Button
                onClick={handleAddToTracking}
                disabled={selectedQueries.size === 0 || adding || addSuccess}
              >
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Ajout...
                  </>
                ) : addSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Ajoutées
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter au suivi ({selectedQueries.size})
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Fermer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
