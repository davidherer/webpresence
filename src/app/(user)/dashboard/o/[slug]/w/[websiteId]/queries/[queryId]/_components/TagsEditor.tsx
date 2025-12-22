"use client";

import { useState, useCallback } from "react";
import { Tag, X, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TagsEditorProps {
  orgSlug: string;
  websiteId: string;
  queryId: string;
  initialTags: string[];
}

export function TagsEditor({ orgSlug, websiteId, queryId, initialTags }: TagsEditorProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveTags = useCallback(async (updatedTags: string[]) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/organizations/${orgSlug}/websites/${websiteId}/queries/${queryId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: updatedTags }),
        }
      );
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }
      
      setTags(updatedTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      // Revert to previous tags on error
      setTags(tags);
    } finally {
      setIsLoading(false);
    }
  }, [orgSlug, websiteId, queryId, tags]);

  const addTag = useCallback(() => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (!trimmedTag) return;
    if (tags.includes(trimmedTag)) {
      setError("Ce tag existe déjà");
      return;
    }
    if (tags.length >= 10) {
      setError("Maximum 10 tags autorisés");
      return;
    }
    if (trimmedTag.length > 50) {
      setError("Le tag ne doit pas dépasser 50 caractères");
      return;
    }
    
    const updatedTags = [...tags, trimmedTag];
    setNewTag("");
    saveTags(updatedTags);
  }, [newTag, tags, saveTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    const updatedTags = tags.filter(t => t !== tagToRemove);
    saveTags(updatedTags);
  }, [tags, saveTags]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="w-4 h-4" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current tags */}
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun tag</p>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  disabled={isLoading}
                  className="ml-1 hover:text-destructive transition-colors disabled:opacity-50"
                  aria-label={`Supprimer le tag ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add new tag */}
        <div className="flex gap-2">
          <Input
            placeholder="Ajouter un tag..."
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
            maxLength={50}
          />
          <Button
            onClick={addTag}
            disabled={isLoading || !newTag.trim()}
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Error message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Utilisez les tags pour grouper vos requêtes (ex: produit, service, localisation, catégorie...)
        </p>
      </CardContent>
    </Card>
  );
}
