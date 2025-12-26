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
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
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
              <Label htmlFor="intent">Type d'intention</Label>
              <Select value={intentType} onValueChange={setIntentType}>
                <SelectTrigger id="intent">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="informational">
                    Informationnelles (recherche d'info)
                  </SelectItem>
                  <SelectItem value="commercial">
                    Commerciales (intention d'achat)
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
                Filtrez par type d'intention de recherche
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
                💡 L'IA analysera le contenu extrait (titre, meta, headings,
                keywords) pour suggérer des requêtes pertinentes selon vos
                critères.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950 p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-900 dark:text-red-100">
                  {error}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 flex items-start gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-900 dark:text-green-100">
                Génération terminée ! Voici les requêtes suggérées.
              </p>
            </div>

            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requête</TableHead>
                    <TableHead className="w-[100px]">Intention</TableHead>
                    <TableHead className="w-[120px]">Concurrence</TableHead>
                    <TableHead className="w-[100px] text-center">
                      Pertinence
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queries.map((q, idx) => (
                    <TableRow key={idx}>
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
              <Button onClick={handleClose}>Fermer</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
