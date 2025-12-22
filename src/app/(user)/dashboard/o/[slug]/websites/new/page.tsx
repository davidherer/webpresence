"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Globe } from "lucide-react";
import { use } from "react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function NewWebsitePage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate URL
    let validUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      validUrl = `https://${url}`;
    }

    try {
      new URL(validUrl);
    } catch {
      setError("URL invalide");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/organizations/${slug}/websites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url: validUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/o/${slug}/w/${data.data.id}`);
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-xl">
      <Link
        href={`/dashboard/o/${slug}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour à l&apos;organisation
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Nouveau site web
          </CardTitle>
          <CardDescription>
            Ajoutez un site web pour analyser son positionnement SEO et identifier vos produits/services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nom du site
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mon Site Web"
                required
                minLength={1}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="url" className="text-sm font-medium">
                URL du site
              </label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://monsite.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                L&apos;URL principale de votre site (ex: https://monsite.com)
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Que va-t-il se passer ?</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Analyse du sitemap de votre site</li>
                <li>• Extraction des pages clés</li>
                <li>• Identification automatique de vos produits/services par IA</li>
                <li>• Premier rapport d&apos;analyse</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ajout en cours..." : "Ajouter et analyser"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
