"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface AnalyzeButtonProps {
  orgSlug: string;
  websiteId: string;
  isAnalyzing: boolean;
}

export function AnalyzeButton({ orgSlug, websiteId, isAnalyzing }: AnalyzeButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/websites/${websiteId}/analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to start analysis");
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error("Failed to start analysis:", error);
      alert(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const disabled = isAnalyzing || loading;

  return (
    <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={disabled}>
      <RefreshCw className={`w-4 h-4 mr-2 ${disabled ? "animate-spin" : ""}`} />
      {disabled ? "Analyse en cours..." : "Relancer l'analyse"}
    </Button>
  );
}
