"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Sparkles, X, Loader2, ArrowRight } from "lucide-react";
import { GenerateQueriesDialog } from "./GenerateQueriesDialog";

interface OnboardingBannerProps {
  orgSlug: string;
  websiteId: string;
  websiteUrl: string;
  onDismiss?: () => void;
}

export function OnboardingBanner({ 
  orgSlug, 
  websiteId, 
  websiteUrl,
  onDismiss
}: OnboardingBannerProps) {
  const router = useRouter();
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [analyzingLoading, setAnalyzingLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleStartAnalysis = async () => {
    setAnalyzingLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/websites/${websiteId}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec de l'analyse");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setAnalyzingLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <>
      <Card className="mb-8 border-purple-200 bg-linear-to-r from-purple-50 to-blue-50 dark:border-purple-800 dark:from-purple-950/50 dark:to-blue-950/50">
        <CardContent className="py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">
                🚀 Commencer le suivi SEO
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choisissez comment vous voulez identifier vos requêtes de recherche :
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  className="bg-white dark:bg-gray-900"
                  onClick={handleStartAnalysis}
                  disabled={analyzingLoading}
                >
                  {analyzingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 mr-2" />
                      Analyser {websiteUrl}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={() => setShowGenerateDialog(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Générer depuis une idée
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <GenerateQueriesDialog
        orgSlug={orgSlug}
        websiteId={websiteId}
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onSuccess={() => {
          setShowGenerateDialog(false);
          router.refresh();
        }}
      />
    </>
  );
}
