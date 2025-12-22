"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Loader2 } from "lucide-react";

interface GenerateQueriesDialogProps {
  orgSlug: string;
  websiteId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function GenerateQueriesDialog({ 
  orgSlug, 
  websiteId, 
  isOpen, 
  onClose,
  onSuccess 
}: GenerateQueriesDialogProps) {
  const router = useRouter();
  const [projectIdea, setProjectIdea] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    queriesCreated: number;
    summary: string;
    recommendations: string[];
  } | null>(null);

  const handleGenerateQueries = async () => {
    if (projectIdea.trim().length < 10) {
      setError("Décrivez votre idée de projet en au moins 10 caractères");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/organizations/${orgSlug}/websites/${websiteId}/generate-queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectIdea: projectIdea.trim(),
          targetAudience: targetAudience.trim() || undefined,
          location: location.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Échec de la génération");
      }

      setResult({
        queriesCreated: data.data.queriesCreated,
        summary: data.data.summary,
        recommendations: data.data.recommendations,
      });

      // Refresh data
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <CardTitle>Générer des requêtes avec l&apos;IA</CardTitle>
          <CardDescription>
            Décrivez votre projet et l&apos;IA génèrera les requêtes de recherche pertinentes pour votre marché.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="font-medium text-green-800 dark:text-green-200">
                  ✓ {result.queriesCreated} requête(s) générée(s)
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="font-medium text-sm">Résumé</p>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-sm">Recommandations</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i}>• {rec}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleClose}>
                  Fermer
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setResult(null);
                    setProjectIdea("");
                    setTargetAudience("");
                    setLocation("");
                  }}
                >
                  Générer d&apos;autres requêtes
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="projectIdea" className="text-sm font-medium">
                  Description du projet *
                </label>
                <textarea
                  id="projectIdea"
                  className="flex min-h-30 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ex: Je veux créer une boutique en ligne de vêtements de mode éthique, avec des vêtements fabriqués en France à partir de matériaux recyclés..."
                  value={projectIdea}
                  onChange={(e) => setProjectIdea(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Plus votre description est détaillée, plus les requêtes seront pertinentes.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="targetAudience" className="text-sm font-medium">
                  Audience cible (optionnel)
                </label>
                <Input
                  id="targetAudience"
                  placeholder="Ex: Femmes 25-45 ans, CSP+, sensibles à l'écologie"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium">
                  Localisation (optionnel)
                </label>
                <Input
                  id="location"
                  placeholder="Ex: Paris, France, ou National"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleGenerateQueries}
                  disabled={loading || projectIdea.trim().length < 10}
                >
                  {loading ? (
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
