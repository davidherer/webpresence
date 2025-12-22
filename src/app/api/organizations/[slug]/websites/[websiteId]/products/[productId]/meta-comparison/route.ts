import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

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
  "nos",
  "vos",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "lui",
  "elle",
  "eux",
  "cela",
  "ceci",
  "celui",
  "celle",
  "ceux",
  "celles",
  "lequel",
  "laquelle",
  "lesquels",
  "été",
  "était",
  "ont",
  "sera",
  "seront",
  "peut",
  "peuvent",
  "doit",
  "doivent",
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "we",
  "they",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "but",
  "if",
  "then",
  "because",
  "as",
  "until",
  "while",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "from",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
  "here",
  "there",
]);

// Extract meaningful keywords from text
function extractKeywords(text: string | null): Map<string, number> {
  if (!text) return new Map();

  const keywords = new Map<string, number>();

  // Normalize and tokenize
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents for matching
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !FRENCH_STOPWORDS.has(word));

  for (const word of words) {
    keywords.set(word, (keywords.get(word) || 0) + 1);
  }

  return keywords;
}

// Extract bi-grams (2-word combinations)
function extractBigrams(text: string | null): Map<string, number> {
  if (!text) return new Map();

  const bigrams = new Map<string, number>();

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ\s-]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    // Skip if both words are stopwords
    if (
      !FRENCH_STOPWORDS.has(words[i]) ||
      !FRENCH_STOPWORDS.has(words[i + 1])
    ) {
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
  }

  return bigrams;
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

/**
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/meta-comparison
 * Get SEO metadata comparison between client and competitors
 * Includes deep keyword analysis
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

  // Get client's page analysis (from the sourceUrl of the product)
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

  // If no analysis from sourceUrl, try to get the most recent one for this website
  if (!clientPageAnalysis) {
    clientPageAnalysis = await prisma.pageAnalysis.findFirst({
      where: { websiteId },
      orderBy: { createdAt: "desc" },
    });
  }

  // Get competitors for this website
  const competitors = await prisma.competitor.findMany({
    where: { websiteId, isActive: true },
    include: {
      pageAnalyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Extract keywords from client data
  const clientTitle = clientPageAnalysis?.title || null;
  const clientDescription = clientPageAnalysis?.metaDescription || null;
  const clientTitleKeywords = extractKeywords(clientTitle);
  const clientDescKeywords = extractKeywords(clientDescription);
  const clientAllKeywords = new Map<string, number>();
  clientTitleKeywords.forEach((count, word) => {
    clientAllKeywords.set(word, (clientAllKeywords.get(word) || 0) + count * 2); // Title keywords weight x2
  });
  clientDescKeywords.forEach((count, word) => {
    clientAllKeywords.set(word, (clientAllKeywords.get(word) || 0) + count);
  });

  // Extract bi-grams from client
  const clientTitleBigrams = extractBigrams(clientTitle);
  const clientDescBigrams = extractBigrams(clientDescription);

  // Aggregate competitor keywords
  const competitorKeywordsFrequency = new Map<
    string,
    { count: number; competitors: string[] }
  >();
  const competitorBigramsFrequency = new Map<
    string,
    { count: number; competitors: string[] }
  >();
  const competitorTitleKeywordsFrequency = new Map<
    string,
    { count: number; competitors: string[] }
  >();

  // Build comparison data
  const competitorData = competitors
    .filter((c) => c.pageAnalyses.length > 0)
    .map((competitor) => {
      const analysis = competitor.pageAnalyses[0];
      const title = analysis?.title || null;
      const description = analysis?.metaDescription || null;

      // Extract keywords
      const titleKeywords = extractKeywords(title);
      const descKeywords = extractKeywords(description);
      const titleBigrams = extractBigrams(title);
      const descBigrams = extractBigrams(description);

      // Aggregate to global frequency
      titleKeywords.forEach((count, word) => {
        const existing = competitorKeywordsFrequency.get(word) || {
          count: 0,
          competitors: [],
        };
        existing.count += count;
        if (!existing.competitors.includes(competitor.name)) {
          existing.competitors.push(competitor.name);
        }
        competitorKeywordsFrequency.set(word, existing);

        // Also track title-specific keywords
        const titleExisting = competitorTitleKeywordsFrequency.get(word) || {
          count: 0,
          competitors: [],
        };
        titleExisting.count += count;
        if (!titleExisting.competitors.includes(competitor.name)) {
          titleExisting.competitors.push(competitor.name);
        }
        competitorTitleKeywordsFrequency.set(word, titleExisting);
      });

      descKeywords.forEach((count, word) => {
        const existing = competitorKeywordsFrequency.get(word) || {
          count: 0,
          competitors: [],
        };
        existing.count += count;
        if (!existing.competitors.includes(competitor.name)) {
          existing.competitors.push(competitor.name);
        }
        competitorKeywordsFrequency.set(word, existing);
      });

      // Aggregate bigrams
      [...titleBigrams.entries(), ...descBigrams.entries()].forEach(
        ([bigram, count]) => {
          const existing = competitorBigramsFrequency.get(bigram) || {
            count: 0,
            competitors: [],
          };
          existing.count += count;
          if (!existing.competitors.includes(competitor.name)) {
            existing.competitors.push(competitor.name);
          }
          competitorBigramsFrequency.set(bigram, existing);
        }
      );

      return {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        title,
        metaDescription: description,
        titleLength: title?.length || 0,
        descriptionLength: description?.length || 0,
        keywords: {
          title: Array.from(titleKeywords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count })),
          description: Array.from(descKeywords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({ word, count })),
        },
        bigrams: Array.from(
          new Map([...titleBigrams, ...descBigrams]).entries()
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([phrase, count]) => ({ phrase, count })),
      };
    });

  // Find missing keywords (used by competitors but not by client)
  const missingKeywords: Array<{
    word: string;
    usedBy: number;
    competitors: string[];
  }> = [];
  competitorKeywordsFrequency.forEach((data, word) => {
    if (!clientAllKeywords.has(word) && data.competitors.length >= 2) {
      missingKeywords.push({
        word,
        usedBy: data.competitors.length,
        competitors: data.competitors,
      });
    }
  });
  missingKeywords.sort((a, b) => b.usedBy - a.usedBy);

  // Find missing keywords specifically in titles
  const missingTitleKeywords: Array<{
    word: string;
    usedBy: number;
    competitors: string[];
  }> = [];
  competitorTitleKeywordsFrequency.forEach((data, word) => {
    if (!clientTitleKeywords.has(word) && data.competitors.length >= 2) {
      missingTitleKeywords.push({
        word,
        usedBy: data.competitors.length,
        competitors: data.competitors,
      });
    }
  });
  missingTitleKeywords.sort((a, b) => b.usedBy - a.usedBy);

  // Find common competitor keywords (used by multiple competitors)
  const trendingKeywords = Array.from(competitorKeywordsFrequency.entries())
    .filter(([, data]) => data.competitors.length >= 2)
    .sort(
      (a, b) =>
        b[1].competitors.length - a[1].competitors.length ||
        b[1].count - a[1].count
    )
    .slice(0, 15)
    .map(([word, data]) => ({
      word,
      totalCount: data.count,
      usedBy: data.competitors.length,
      clientHas: clientAllKeywords.has(word),
      clientCount: clientAllKeywords.get(word) || 0,
    }));

  // Find trending bi-grams
  const trendingBigrams = Array.from(competitorBigramsFrequency.entries())
    .filter(([, data]) => data.competitors.length >= 2)
    .sort((a, b) => b[1].competitors.length - a[1].competitors.length)
    .slice(0, 10)
    .map(([phrase, data]) => ({
      phrase,
      usedBy: data.competitors.length,
      clientHas:
        clientTitleBigrams.has(phrase) || clientDescBigrams.has(phrase),
    }));

  // Build client data
  const clientData = {
    url: product.sourceUrl || product.website.url,
    title: clientTitle,
    metaDescription: clientDescription,
    titleLength: clientTitle?.length || 0,
    descriptionLength: clientDescription?.length || 0,
    keywords: {
      title: Array.from(clientTitleKeywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count })),
      description: Array.from(clientDescKeywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count })),
      all: Array.from(clientAllKeywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word, count]) => ({ word, count })),
    },
    bigrams: {
      title: Array.from(clientTitleBigrams.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([phrase, count]) => ({ phrase, count })),
      description: Array.from(clientDescBigrams.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([phrase, count]) => ({ phrase, count })),
    },
  };

  // Calculate averages for benchmarking
  const avgCompetitorTitleLength =
    competitorData.length > 0
      ? Math.round(
          competitorData.reduce((sum, c) => sum + c.titleLength, 0) /
            competitorData.length
        )
      : 0;

  const avgCompetitorDescriptionLength =
    competitorData.length > 0
      ? Math.round(
          competitorData.reduce((sum, c) => sum + c.descriptionLength, 0) /
            competitorData.length
        )
      : 0;

  // SEO best practices
  const recommendations = {
    titleOptimalRange: { min: 50, max: 60 },
    descriptionOptimalRange: { min: 150, max: 160 },
  };

  // Generate insights
  const insights: string[] = [];

  if (clientData.titleLength > 0) {
    if (clientData.titleLength < recommendations.titleOptimalRange.min) {
      insights.push(
        `Votre titre (${clientData.titleLength} car.) est trop court. Visez ${recommendations.titleOptimalRange.min}-${recommendations.titleOptimalRange.max} caractères.`
      );
    } else if (clientData.titleLength > recommendations.titleOptimalRange.max) {
      insights.push(
        `Votre titre (${clientData.titleLength} car.) risque d'être tronqué. Limitez à ${recommendations.titleOptimalRange.max} caractères.`
      );
    }
  }

  if (clientData.descriptionLength > 0) {
    if (
      clientData.descriptionLength < recommendations.descriptionOptimalRange.min
    ) {
      insights.push(
        `Votre description (${clientData.descriptionLength} car.) est trop courte. Visez ${recommendations.descriptionOptimalRange.min}-${recommendations.descriptionOptimalRange.max} caractères.`
      );
    } else if (
      clientData.descriptionLength > recommendations.descriptionOptimalRange.max
    ) {
      insights.push(
        `Votre description (${clientData.descriptionLength} car.) risque d'être tronquée. Limitez à ${recommendations.descriptionOptimalRange.max} caractères.`
      );
    }
  }

  // Keyword-based insights
  if (missingTitleKeywords.length > 0) {
    const topMissing = missingTitleKeywords
      .slice(0, 3)
      .map((k) => k.word)
      .join(", ");
    insights.push(
      `Mots-clés manquants dans votre titre : ${topMissing}. Ces termes sont utilisés par ${missingTitleKeywords[0].usedBy} concurrents.`
    );
  }

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords
      .slice(0, 3)
      .map((k) => k.word)
      .join(", ");
    insights.push(
      `Mots-clés populaires chez vos concurrents mais absents de votre page : ${topMissing}.`
    );
  }

  const keywordsClientHas = trendingKeywords.filter((k) => k.clientHas).length;
  const totalTrending = trendingKeywords.length;
  if (totalTrending > 0) {
    const coverage = Math.round((keywordsClientHas / totalTrending) * 100);
    if (coverage < 50) {
      insights.push(
        `Couverture des mots-clés tendance : ${coverage}%. Vous n'utilisez que ${keywordsClientHas}/${totalTrending} des termes populaires.`
      );
    }
  }

  if (competitorData.length > 0) {
    if (clientData.titleLength < avgCompetitorTitleLength - 10) {
      insights.push(
        `Votre titre est plus court que la moyenne des concurrents (${avgCompetitorTitleLength} car.).`
      );
    }
    if (clientData.descriptionLength < avgCompetitorDescriptionLength - 20) {
      insights.push(
        `Votre description est plus courte que celle des concurrents (moy. ${avgCompetitorDescriptionLength} car.).`
      );
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      client: clientData,
      competitors: competitorData,
      averages: {
        competitorTitleLength: avgCompetitorTitleLength,
        competitorDescriptionLength: avgCompetitorDescriptionLength,
      },
      recommendations,
      insights,
      keywordAnalysis: {
        trendingKeywords,
        trendingBigrams,
        missingKeywords: missingKeywords.slice(0, 10),
        missingTitleKeywords: missingTitleKeywords.slice(0, 5),
        keywordCoverage:
          totalTrending > 0
            ? Math.round((keywordsClientHas / totalTrending) * 100)
            : 0,
      },
      hasData: clientData.title !== null || competitorData.length > 0,
    },
  });
});
