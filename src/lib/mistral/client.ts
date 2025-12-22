import { Mistral } from "@mistralai/mistralai";
import type { AIAnalysisResult } from "@/types";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

const client = new Mistral({ apiKey: MISTRAL_API_KEY });

// Model to use - mistral-large for complex analysis, mistral-small for simpler tasks
const MODEL_LARGE = "mistral-large-latest";
const MODEL_SMALL = "mistral-small-latest";

interface PageContent {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  keywords: Array<{ keyword: string; frequency: number }>;
}

/**
 * Analyze pages to identify products and services
 */
export async function identifyProductsAndServices(
  websiteName: string,
  websiteUrl: string,
  pages: PageContent[]
): Promise<AIAnalysisResult> {
  const pagesContext = pages
    .map(
      (page) => `
URL: ${page.url}
Title: ${page.title || "N/A"}
Description: ${page.metaDescription || "N/A"}
H1: ${page.headings.h1.join(", ") || "N/A"}
H2: ${page.headings.h2.slice(0, 10).join(", ") || "N/A"}
Top Keywords: ${
        page.keywords
          .slice(0, 15)
          .map((k) => k.keyword)
          .join(", ") || "N/A"
      }
`
    )
    .join("\n---\n");

  const prompt = `Tu es un expert en analyse de sites web et en SEO. Analyse les pages suivantes du site "${websiteName}" (${websiteUrl}) et identifie les produits et services proposés.

PAGES ANALYSÉES:
${pagesContext}

INSTRUCTIONS:
1. Identifie tous les produits et services distincts proposés par ce site
2. Pour chaque produit/service, détermine:
   - Un nom clair et concis
   - Une description en 1-2 phrases
   - Les mots-clés principaux associés (5-10 mots-clés pertinents pour le SEO)
   - L'URL source où ce produit/service a été identifié
   - Un score de confiance (0-1) basé sur la clarté de l'information

3. Fournis un résumé général du positionnement du site
4. Donne 3-5 recommandations initiales pour améliorer la visibilité

RÉPONDS UNIQUEMENT EN JSON avec cette structure exacte:
{
  "products": [
    {
      "name": "Nom du produit/service",
      "description": "Description courte",
      "keywords": ["mot-clé1", "mot-clé2"],
      "sourceUrl": "https://...",
      "confidence": 0.85
    }
  ],
  "summary": "Résumé du positionnement du site",
  "recommendations": ["Recommandation 1", "Recommandation 2"]
}`;

  const response = await client.chat.complete({
    model: MODEL_LARGE,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Mistral AI");
  }

  try {
    return JSON.parse(content) as AIAnalysisResult;
  } catch {
    console.error("[Mistral] Failed to parse JSON response:", content);
    throw new Error("Invalid JSON response from Mistral AI");
  }
}

/**
 * Generate periodic recap report
 */
export async function generatePeriodicRecap(
  websiteName: string,
  productsData: Array<{
    name: string;
    keywords: string[];
    currentPositions: Array<{ query: string; position: number | null }>;
    previousPositions: Array<{ query: string; position: number | null }>;
  }>,
  competitorsData: Array<{
    name: string;
    url: string;
    positions: Array<{ query: string; position: number | null }>;
  }>,
  periodDays: number
): Promise<{ title: string; content: string; highlights: string[] }> {
  const prompt = `Tu es un expert SEO. Génère un rapport récapitulatif pour le site "${websiteName}" sur les ${periodDays} derniers jours.

DONNÉES DES PRODUITS/SERVICES:
${JSON.stringify(productsData, null, 2)}

DONNÉES DES CONCURRENTS:
${JSON.stringify(competitorsData, null, 2)}

INSTRUCTIONS:
1. Analyse l'évolution du positionnement pour chaque produit/service
2. Compare avec les concurrents
3. Identifie les tendances positives et négatives
4. Donne un résumé exécutif clair et actionnable

RÉPONDS EN JSON:
{
  "title": "Titre du rapport",
  "content": "Contenu Markdown du rapport complet (utilise des titres, listes, etc.)",
  "highlights": ["Point clé 1", "Point clé 2", "Point clé 3"]
}`;

  const response = await client.chat.complete({
    model: MODEL_LARGE,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.4,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Mistral AI");
  }

  return JSON.parse(content);
}

/**
 * Generate SEO improvement suggestions for a product/service
 */
export async function generateSEOSuggestions(
  productName: string,
  productKeywords: string[],
  currentPage: PageContent,
  serpResults: Array<{
    position: number;
    url: string;
    title: string;
    snippet: string;
  }>,
  competitorPages: PageContent[]
): Promise<
  Array<{
    type: "content" | "keyword" | "technical" | "backlink";
    title: string;
    content: string;
    priority: number;
  }>
> {
  const prompt = `Tu es un expert SEO. Analyse les données suivantes et propose des améliorations pour augmenter la visibilité du produit/service "${productName}".

PAGE ACTUELLE:
${JSON.stringify(currentPage, null, 2)}

MOTS-CLÉS CIBLÉS: ${productKeywords.join(", ")}

RÉSULTATS SERP ACTUELS:
${JSON.stringify(serpResults.slice(0, 10), null, 2)}

PAGES CONCURRENTES (mieux positionnées):
${JSON.stringify(competitorPages.slice(0, 3), null, 2)}

INSTRUCTIONS:
Propose des améliorations concrètes et actionnables dans ces catégories:
- "content": Améliorations du contenu (texte, structure, etc.)
- "keyword": Optimisations des mots-clés (nouveaux mots-clés, densité, placement)
- "technical": Améliorations techniques (balises, structure HTML, vitesse)
- "backlink": Stratégies de netlinking

Pour chaque suggestion:
- Sois précis et actionnable
- Donne une priorité (1-10, 10 = très important)
- Explique l'impact attendu

RÉPONDS EN JSON:
{
  "suggestions": [
    {
      "type": "content",
      "title": "Titre court",
      "content": "Description détaillée de l'action à mener et pourquoi",
      "priority": 8
    }
  ]
}`;

  const response = await client.chat.complete({
    model: MODEL_LARGE,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.5,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Mistral AI");
  }

  const result = JSON.parse(content);
  return result.suggestions || [];
}

/**
 * Analyze competitor and compare with our site
 */
export async function analyzeCompetitor(
  ourWebsiteName: string,
  ourPages: PageContent[],
  competitorName: string,
  competitorUrl: string,
  competitorPages: PageContent[],
  sharedKeywords: string[]
): Promise<{
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  summary: string;
}> {
  const prompt = `Tu es un expert en analyse concurrentielle SEO. Compare notre site "${ourWebsiteName}" avec le concurrent "${competitorName}" (${competitorUrl}).

NOTRE SITE:
${JSON.stringify(ourPages.slice(0, 5), null, 2)}

CONCURRENT:
${JSON.stringify(competitorPages.slice(0, 5), null, 2)}

MOTS-CLÉS EN COMMUN: ${sharedKeywords.join(", ")}

INSTRUCTIONS:
Effectue une analyse SWOT (Forces, Faiblesses, Opportunités, Menaces) de notre positionnement par rapport à ce concurrent.

RÉPONDS EN JSON:
{
  "strengths": ["Force 1", "Force 2"],
  "weaknesses": ["Faiblesse 1", "Faiblesse 2"],
  "opportunities": ["Opportunité 1", "Opportunité 2"],
  "threats": ["Menace 1", "Menace 2"],
  "summary": "Résumé de l'analyse en 2-3 phrases"
}`;

  const response = await client.chat.complete({
    model: MODEL_LARGE,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.4,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Mistral AI");
  }

  return JSON.parse(content);
}

/**
 * Quick keyword expansion from a seed keyword
 */
export async function expandKeywords(
  seedKeyword: string,
  context: string,
  count = 20
): Promise<string[]> {
  const prompt = `Tu es un expert SEO. À partir du mot-clé "${seedKeyword}" dans le contexte "${context}", génère ${count} mots-clés associés pertinents pour le SEO.

Inclus:
- Variations longue traîne
- Questions que les utilisateurs pourraient poser
- Mots-clés de proximité sémantique
- Variations avec intention d'achat

RÉPONDS EN JSON:
{
  "keywords": ["mot-clé1", "mot-clé2", ...]
}`;

  const response = await client.chat.complete({
    model: MODEL_SMALL,
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
    temperature: 0.6,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Mistral AI");
  }

  const result = JSON.parse(content);
  return result.keywords || [];
}

export const mistral = {
  identifyProductsAndServices,
  generatePeriodicRecap,
  generateSEOSuggestions,
  analyzeCompetitor,
  expandKeywords,
};
