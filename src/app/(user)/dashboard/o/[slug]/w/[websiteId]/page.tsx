"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyzeButton } from "./_components/AnalyzeButton";
import { GenerateQueriesDialog } from "./_components/GenerateQueriesDialog";
import { QueriesColumn } from "./_components/QueriesColumn";
import { CompetitorsColumn } from "./_components/CompetitorsColumn";
import { ReportsColumn } from "./_components/ReportsColumn";
import { SitemapColumn } from "./_components/SitemapColumn";
import { ExtractionsColumn } from "./_components/ExtractionsColumn";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

interface SerpResult {
  position: number | null;
  createdAt: Date;
}

interface SearchQuery {
  id: string;
  query: string;
  description: string | null;
  competitionLevel: "HIGH" | "LOW";
  serpResults: SerpResult[];
  _count: {
    aiSuggestions: number;
  };
}

interface Competitor {
  id: string;
  name: string;
  url: string;
  serpResults: SerpResult[];
}

interface AIReport {
  id: string;
  type: string;
  title: string;
  createdAt: Date;
}

interface Website {
  id: string;
  name: string;
  url: string;
  status: string;
  searchQueries: SearchQuery[];
  competitors: Competitor[];
  aiReports: AIReport[];
}

interface WebsiteData {
  website: Website;
}

export default function WebsitePage({ params }: PageProps) {
  const { slug, websiteId } = use(params);
  const [data, setData] = useState<WebsiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  // Reload data function
  const reloadData = async () => {
    try {
      const response = await fetch(`/api/organizations/${slug}/websites/${websiteId}/dashboard`);
      if (response.ok) {
        const websiteData = await response.json();
        setData(websiteData);
      }
    } catch (err) {
      console.error("Failed to reload data:", err);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/organizations/${slug}/websites/${websiteId}/dashboard`);
        if (response.ok) {
          const websiteData = await response.json();
          setData(websiteData);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load website data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, websiteId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg text-muted-foreground">Site web introuvable</p>
        <Link href={`/dashboard/o/${slug}`}>
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à l&apos;organisation
          </Button>
        </Link>
      </div>
    );
  }

  const { website } = data;

  return (
    <div className="w-full min-h-screen p-4">
      {/* Header compact */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/o/${slug}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <a
              href={website.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {website.url}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerateDialog(true)}>
            <Sparkles className="w-4 h-4 mr-1" />
            Générer
          </Button>
          <AnalyzeButton
            orgSlug={slug}
            websiteId={websiteId}
            isAnalyzing={website.status === "analyzing"}
          />
        </div>
      </div>

      {/* Status banner */}
      {website.status === "analyzing" && (
        <Card className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="flex items-center gap-3 py-3">
            <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            <div>
              <p className="text-sm font-medium">Analyse en cours</p>
              <p className="text-xs text-muted-foreground">
                Identification des requêtes de recherche pertinentes en cours...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Queries Dialog */}
      <GenerateQueriesDialog
        orgSlug={slug}
        websiteId={websiteId}
        isOpen={showGenerateDialog}
        onClose={() => setShowGenerateDialog(false)}
        onSuccess={() => {
          setShowGenerateDialog(false);
          reloadData();
        }}
      />

      {/* Layout 5 colonnes avec scroll horizontal */}
      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          <div className="w-[400px] flex-shrink-0">
            <SitemapColumn 
              orgSlug={slug} 
              websiteId={websiteId}
              websiteUrl={website.url}
            />
          </div>
          <div className="w-[400px] flex-shrink-0">
            <ExtractionsColumn 
              websiteId={websiteId}
            />
          </div>
          <div className="w-[400px] flex-shrink-0">
            <QueriesColumn 
              queries={website.searchQueries} 
              orgSlug={slug} 
              websiteId={websiteId} 
            />
          </div>
          <div className="w-[400px] flex-shrink-0">
            <CompetitorsColumn 
              orgSlug={slug} 
              websiteId={websiteId} 
            />
          </div>
          <div className="w-[400px] flex-shrink-0">
            <ReportsColumn 
              reports={website.aiReports} 
              orgSlug={slug} 
              websiteId={websiteId} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}