"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Save, RefreshCw, Pencil } from "lucide-react";

interface KeywordsManagerProps {
  orgSlug: string;
  websiteId: string;
  productId: string;
  initialKeywords: string[];
}

export function KeywordsManager({
  orgSlug,
  websiteId,
  productId,
  initialKeywords,
}: KeywordsManagerProps) {
  const [keywords, setKeywords] = useState<string[]>(initialKeywords);
  const [newKeyword, setNewKeyword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed) && keywords.length < 20) {
      setKeywords([...keywords, trimmed]);
      setNewKeyword("");
      setHasChanges(true);
    }
  };

  const removeKeyword = (keyword: string) => {
    setKeywords(keywords.filter((k) => k !== keyword));
    setHasChanges(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  const saveKeywords = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/products/${productId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords }),
        }
      );

      const json = await res.json();
      if (json.success) {
        setHasChanges(false);
        setIsEditing(false);
      } else {
        console.error("Failed to save keywords:", json.error);
        alert("Erreur lors de la sauvegarde: " + json.error);
      }
    } catch (error) {
      console.error("Failed to save keywords:", error);
      alert("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditing = () => {
    setKeywords(initialKeywords);
    setNewKeyword("");
    setHasChanges(false);
    setIsEditing(false);
  };

  // Suggestions de mots-clés plus pertinents
  const suggestedKeywords = [
    "location groupe électrogène",
    "groupe électrogène chantier",
    "location générateur électrique",
    "groupe électrogène événementiel",
    "location cuve carburant",
    "alimentation électrique temporaire",
  ].filter((s) => !keywords.includes(s.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mots-clés surveillés</CardTitle>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Modifier
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={saveKeywords}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Enregistrer
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current keywords */}
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, i) => (
            <span
              key={i}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                isEditing
                  ? "bg-primary/10 text-primary pr-2"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {keyword}
              {isEditing && (
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="ml-2 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                  aria-label={`Supprimer ${keyword}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
          {keywords.length === 0 && (
            <span className="text-muted-foreground text-sm">
              Aucun mot-clé défini
            </span>
          )}
        </div>

        {/* Add keyword input */}
        {isEditing && (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Ajouter un mot-clé..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                disabled={keywords.length >= 20}
              />
              <Button
                variant="outline"
                onClick={addKeyword}
                disabled={!newKeyword.trim() || keywords.length >= 20}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {keywords.length}/20 mots-clés • Appuyez sur Entrée pour ajouter
            </p>

            {/* Suggestions */}
            {suggestedKeywords.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  💡 Suggestions de mots-clés plus ciblés :
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedKeywords.slice(0, 4).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (keywords.length < 20) {
                          setKeywords([...keywords, suggestion.toLowerCase()]);
                          setHasChanges(true);
                        }
                      }}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tips */}
        {!isEditing && keywords.length > 0 && (
          <p className="text-xs text-muted-foreground">
            💡 Utilisez des expressions de recherche spécifiques (ex: &quot;location groupe électrogène chantier&quot;) plutôt que des mots génériques.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
