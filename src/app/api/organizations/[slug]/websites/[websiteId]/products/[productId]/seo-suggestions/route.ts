import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { Mistral } from "@mistralai/mistralai";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const MODEL_LARGE = "mistral-large-latest";

// French stopwords to filter out
const FRENCH_STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "de",
  "du",
  "des",
  "un",
  "une",
  "et",
  "en",
  "à",
  "au",
  "aux",
  "ce",
  "ces",
  "cette",
  "pour",
  "par",
  "sur",
  "avec",
  "dans",
  "qui",
  "que",
  "quoi",
  "dont",
  "où",
  "son",
  "sa",
  "ses",
  "leur",
  "leurs",
  "nous",
  "vous",
  "ils",
  "elles",
  "est",
  "sont",
  "être",
  "avoir",
  "fait",
  "faire",
  "plus",
  "moins",
  "très",
  "bien",
  "tout",
  "tous",
  "toute",
  "toutes",
  "même",
  "aussi",
  "comme",
  "mais",
  "ou",
  "donc",
  "car",
  "ni",
  "si",
  "pas",
  "ne",
  "sans",
  "sous",
  "entre",
  "vers",
  "chez",
  "après",
  "avant",
  "depuis",
  "pendant",
  "selon",
  "contre",
  "malgré",
  "grâce",
  "votre",
  "notre",
]);

function extractKeywords(text: string | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FRENCH_STOPWORDS.has(word));
}

// Helper to check product access
async function checkProductAccess(
  userId: string,
  slug: string,
  websiteId: string,
  productId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug },
    },
  });

  if (!membership) {
    return null;
  }

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      websiteId,
      website: { organizationId: membership.organizationId },
    },
    include: { website: true },
  });

  return product;
}

interface SEOSuggestion {
  type:
    | "title"
    | "description"
    | "url"
    | "headings"
    | "new_page"
    | "content"
    | "keyword";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  currentValue?: string;
  suggestedValue?: string;
  reasoning: string;
}

interface AIResponse {
  suggestions: SEOSuggestion[];
  globalAnalysis: string;
  quickWins: string[];
  longTermStrategy: string[];
}

/**
 * POST /api/organizations/:slug/websites/:websiteId/products/:productId/seo-suggestions
 * Generate AI-powered SEO suggestions based on comparative analysis
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  // Get client's page analysis
  let clientPageAnalysis = null;
  if (product.sourceUrl) {
    clientPageAnalysis = await prisma.pageAnalysis.findFirst({
      where: {
        websiteId,
        url: product.sourceUrl,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!clientPageAnalysis) {
    clientPageAnalysis = await prisma.pageAnalysis.findFirst({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Get competitors with their page analyses
  const competitors = await prisma.competitor.findMany({
    where: { websiteId, isActive: true },
    include: {
      pageAnalyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Prepare data for AI analysis
  const clientData = {
    url: product.sourceUrl || product.website.url,
    name: product.name,
    description: product.description,
    keywords: product.keywords,
    title: clientPageAnalysis?.title || null,
    metaDescription: clientPageAnalysis?.metaDescription || null,
    headings: clientPageAnalysis?.headings as {
      h1?: string[];
      h2?: string[];
      h3?: string[];
    } | null,
    extractedKeywords: {
      fromTitle: extractKeywords(clientPageAnalysis?.title || null),
      fromDescription: extractKeywords(
        clientPageAnalysis?.metaDescription || null
      ),
    },
  };

  const competitorData = competitors
    .filter((c) => c.pageAnalyses.length > 0)
    .map((competitor) => {
      const analysis = competitor.pageAnalyses[0];
      return {
        name: competitor.name,
        url: competitor.url,
        title: analysis?.title || null,
        metaDescription: analysis?.metaDescription || null,
        headings: analysis?.headings as {
          h1?: string[];
          h2?: string[];
          h3?: string[];
        } | null,
        extractedKeywords: {
          fromTitle: extractKeywords(analysis?.title || null),
          fromDescription: extractKeywords(analysis?.metaDescription || null),
        },
      };
    });

  // Aggregate competitor keywords
  const allCompetitorKeywords = new Set<string>();
  competitorData.forEach((c) => {
    c.extractedKeywords.fromTitle.forEach((k) => allCompetitorKeywords.add(k));
    c.extractedKeywords.fromDescription.forEach((k) =>
      allCompetitorKeywords.add(k)
    );
  });

  // Find keywords used by competitors but not by client
  const clientKeywordsSet = new Set([
    ...clientData.extractedKeywords.fromTitle,
    ...clientData.extractedKeywords.fromDescription,
    ...clientData.keywords,
  ]);

  const missingKeywords = [...allCompetitorKeywords].filter(
    (k) => !clientKeywordsSet.has(k)
  );

  // Build the prompt for Mistral
  const prompt = `Tu es un expert SEO senior. Analyse les données suivantes et génère des suggestions d'optimisation concrètes et actionnables.

## DONNÉES DU CLIENT

**Produit/Service:** ${clientData.name}
**URL actuelle:** ${clientData.url}
**Title actuel:** ${clientData.title || "NON DÉFINI"}
**Meta Description actuelle:** ${clientData.metaDescription || "NON DÉFINIE"}
**Headings actuels:** ${JSON.stringify(clientData.headings) || "NON ANALYSÉS"}
**Mots-clés ciblés:** ${clientData.keywords.join(", ")}
**Mots-clés extraits du Title:** ${
    clientData.extractedKeywords.fromTitle.join(", ") || "Aucun"
  }
**Mots-clés extraits de la Description:** ${
    clientData.extractedKeywords.fromDescription.join(", ") || "Aucun"
  }

## DONNÉES DES CONCURRENTS (${competitorData.length} analysés)

${competitorData
  .map(
    (c, i) => `
### Concurrent ${i + 1}: ${c.name}
- URL: ${c.url}
- Title: ${c.title || "N/A"}
- Description: ${c.metaDescription || "N/A"}
- H1: ${c.headings?.h1?.join(", ") || "N/A"}
- H2: ${c.headings?.h2?.slice(0, 5).join(", ") || "N/A"}
- Mots-clés du title: ${c.extractedKeywords.fromTitle.join(", ") || "N/A"}
`
  )
  .join("\n")}

## MOTS-CLÉS UTILISÉS PAR LES CONCURRENTS MAIS ABSENTS CHEZ LE CLIENT
${missingKeywords.slice(0, 20).join(", ")}

## INSTRUCTIONS

Génère des suggestions SEO précises et actionnables. Pour chaque suggestion:
1. Indique le type: "title", "description", "url", "headings", "new_page", "content", ou "keyword"
2. Indique la priorité: "high", "medium", ou "low"
3. Donne un titre court et clair
4. Décris l'action à mener en détail
5. Si applicable, fournis la valeur actuelle et la valeur suggérée
6. Explique le raisonnement SEO derrière cette suggestion

Propose au minimum:
- 1 suggestion pour optimiser le Title (avec proposition concrète)
- 1 suggestion pour optimiser la Meta Description (avec proposition concrète)
- 1-2 suggestions pour améliorer/réorganiser les Headings
- 1-2 idées de nouvelles pages à créer basées sur les mots-clés des concurrents
- 2-3 suggestions de mots-clés à intégrer

Fournis aussi:
- Une analyse globale en 2-3 phrases
- 3 "quick wins" (actions rapides à fort impact)
- 2-3 éléments de stratégie long terme

RÉPONDS UNIQUEMENT EN JSON avec cette structure:
{
  "suggestions": [
    {
      "type": "title",
      "priority": "high",
      "title": "Optimiser le titre de la page",
      "description": "Description détaillée de l'action",
      "currentValue": "Valeur actuelle si applicable",
      "suggestedValue": "Nouvelle valeur proposée si applicable",
      "reasoning": "Explication SEO"
    }
  ],
  "globalAnalysis": "Analyse globale du positionnement",
  "quickWins": ["Action rapide 1", "Action rapide 2", "Action rapide 3"],
  "longTermStrategy": ["Stratégie 1", "Stratégie 2"]
}`;

  try {
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

    const aiResponse: AIResponse = JSON.parse(content);

    // Delete existing suggestions for this product before creating new ones
    await prisma.aISuggestion.deleteMany({
      where: { productId },
    });

    // Store the suggestions in the database
    for (const suggestion of aiResponse.suggestions) {
      await prisma.aISuggestion.create({
        data: {
          productId,
          type: suggestion.type,
          title: suggestion.title,
          content: `${suggestion.description}\n\n**Raisonnement:** ${
            suggestion.reasoning
          }${
            suggestion.currentValue
              ? `\n\n**Valeur actuelle:** ${suggestion.currentValue}`
              : ""
          }${
            suggestion.suggestedValue
              ? `\n\n**Suggestion:** ${suggestion.suggestedValue}`
              : ""
          }`,
          priority:
            suggestion.priority === "high"
              ? 10
              : suggestion.priority === "medium"
              ? 5
              : 2,
          status: "pending",
        },
      });
    }

    // Store global analysis as a special suggestion
    await prisma.aISuggestion.create({
      data: {
        productId,
        type: "global_analysis",
        title: "Analyse globale",
        content: aiResponse.globalAnalysis,
        priority: 100, // Highest priority to appear first
        status: "pending",
      },
    });

    // Store quick wins as a special suggestion
    await prisma.aISuggestion.create({
      data: {
        productId,
        type: "quick_wins",
        title: "Quick Wins - Actions rapides",
        content: JSON.stringify(aiResponse.quickWins),
        priority: 99,
        status: "pending",
      },
    });

    // Store long term strategy as a special suggestion
    await prisma.aISuggestion.create({
      data: {
        productId,
        type: "long_term",
        title: "Stratégie long terme",
        content: JSON.stringify(aiResponse.longTermStrategy),
        priority: 98,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        suggestions: aiResponse.suggestions,
        globalAnalysis: aiResponse.globalAnalysis,
        quickWins: aiResponse.quickWins,
        longTermStrategy: aiResponse.longTermStrategy,
        savedCount: aiResponse.suggestions.length + 3, // +3 for global, quick wins, long term
      },
    });
  } catch (error) {
    console.error("Mistral AI error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/seo-suggestions
 * Get existing SEO suggestions for this product
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  const allSuggestions = await prisma.aISuggestion.findMany({
    where: { productId },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  // Extract special suggestions
  const globalAnalysisSuggestion = allSuggestions.find(
    (s) => s.type === "global_analysis"
  );
  const quickWinsSuggestion = allSuggestions.find(
    (s) => s.type === "quick_wins"
  );
  const longTermSuggestion = allSuggestions.find((s) => s.type === "long_term");

  // Filter out special suggestions from regular suggestions
  const regularSuggestions = allSuggestions.filter(
    (s) =>
      s.type !== "global_analysis" &&
      s.type !== "quick_wins" &&
      s.type !== "long_term"
  );

  // Parse JSON arrays for quick wins and long term
  let quickWins: string[] = [];
  let longTermStrategy: string[] = [];

  try {
    if (quickWinsSuggestion?.content) {
      quickWins = JSON.parse(quickWinsSuggestion.content);
    }
  } catch {
    quickWins = [];
  }

  try {
    if (longTermSuggestion?.content) {
      longTermStrategy = JSON.parse(longTermSuggestion.content);
    }
  } catch {
    longTermStrategy = [];
  }

  return NextResponse.json({
    success: true,
    data: {
      suggestions: regularSuggestions,
      globalAnalysis: globalAnalysisSuggestion?.content || null,
      quickWins,
      longTermStrategy,
    },
  });
});
