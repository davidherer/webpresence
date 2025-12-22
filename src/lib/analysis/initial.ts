import { prisma } from "@/lib/db";
import { brightdata } from "@/lib/brightdata";
import { mistral } from "@/lib/mistral";
import { storage } from "@/lib/storage";

interface InitialAnalysisResult {
  success: boolean;
  productsIdentified: number;
  pagesAnalyzed: number;
  error?: string;
}

/**
 * Run initial analysis for a website
 * This is the main entry point for analyzing a new website
 */
export async function runInitialAnalysis(
  websiteId: string
): Promise<InitialAnalysisResult> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    include: { organization: true },
  });

  if (!website) {
    throw new Error(`Website not found: ${websiteId}`);
  }

  try {
    // Update status to analyzing
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "analyzing" },
    });

    // Step 1: Fetch sitemap
    console.log(`[Analysis] Fetching sitemap for ${website.url}`);
    const sitemap = await brightdata.fetchSitemap(website.url);

    // Store sitemap in blob
    await storage.storeSitemap(websiteId, sitemap.sitemapUrl, sitemap);

    // Update website with sitemap info
    await prisma.website.update({
      where: { id: websiteId },
      data: {
        sitemapUrl: sitemap.sitemapUrl,
        lastSitemapFetch: new Date(),
      },
    });

    // Step 2: Select key pages to analyze (max 20 for initial analysis)
    const urlsToAnalyze = selectKeyPages(
      sitemap.urls.map((u) => u.loc),
      website.url,
      20
    );

    console.log(`[Analysis] Analyzing ${urlsToAnalyze.length} pages`);

    // Step 3: Scrape and analyze each page
    const pageContents: Array<{
      url: string;
      title: string | null;
      metaDescription: string | null;
      headings: { h1: string[]; h2: string[]; h3: string[] };
      keywords: Array<{ keyword: string; frequency: number }>;
    }> = [];

    for (const url of urlsToAnalyze) {
      try {
        const scrapeResult = await brightdata.scrapePage({ url });

        // Store HTML in blob
        const blobResult = await storage.storeHtml(
          websiteId,
          url,
          scrapeResult.html
        );

        // Extract metadata
        const metadata = brightdata.extractPageMetadata(scrapeResult.html);
        const keywords = brightdata.extractKeywords(scrapeResult.html);

        // Store page analysis in database
        await prisma.pageAnalysis.create({
          data: {
            websiteId,
            url,
            title: metadata.title,
            metaDescription: metadata.metaDescription,
            headings: metadata.headings,
            keywords,
            wordCount: metadata.wordCount,
            htmlBlobUrl: blobResult.url,
          },
        });

        pageContents.push({
          url,
          title: metadata.title,
          metaDescription: metadata.metaDescription,
          headings: metadata.headings,
          keywords: keywords.slice(0, 20),
        });
      } catch (error) {
        console.error(`[Analysis] Failed to scrape ${url}:`, error);
        // Continue with other pages
      }
    }

    if (pageContents.length === 0) {
      throw new Error("Failed to analyze any pages");
    }

    // Step 4: Use AI to identify products/services
    console.log(`[Analysis] Running AI analysis`);
    const aiResult = await mistral.identifyProductsAndServices(
      website.name,
      website.url,
      pageContents
    );

    // Step 5: Save identified products
    const createdProducts: string[] = [];
    for (const product of aiResult.products) {
      const created = await prisma.product.create({
        data: {
          websiteId,
          name: product.name,
          description: product.description,
          keywords: product.keywords,
          sourceUrl: product.sourceUrl,
          confidence: product.confidence,
        },
      });
      createdProducts.push(created.id);
    }

    // Step 6: Save AI report
    await prisma.aIReport.create({
      data: {
        websiteId,
        type: "initial_analysis",
        title: `Analyse initiale de ${website.name}`,
        content: formatInitialReport(aiResult, pageContents.length),
        metadata: {
          pagesAnalyzed: pageContents.length,
          productsIdentified: aiResult.products.length,
          recommendations: aiResult.recommendations,
        },
      },
    });

    // Step 7: Schedule SERP analysis jobs for each product
    for (const productId of createdProducts) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (product) {
        await prisma.analysisJob.create({
          data: {
            websiteId,
            type: "serp_analysis",
            payload: {
              productId,
              queries: product.keywords.slice(0, 5), // Top 5 keywords
            },
            priority: 5,
          },
        });
      }
    }

    // Update website status to active
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "active" },
    });

    return {
      success: true,
      productsIdentified: aiResult.products.length,
      pagesAnalyzed: pageContents.length,
    };
  } catch (error) {
    console.error(`[Analysis] Error for ${website.url}:`, error);

    // Update website status to error
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "error" },
    });

    return {
      success: false,
      productsIdentified: 0,
      pagesAnalyzed: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Select key pages from sitemap URLs
 * Prioritizes: homepage, product/service pages, about, contact
 */
function selectKeyPages(
  urls: string[],
  baseUrl: string,
  maxPages: number
): string[] {
  const priorityPatterns = [
    /^\/$/, // Homepage
    /^\/?$/, // Homepage variant
    /\/produits?/i, // Products
    /\/services?/i, // Services
    /\/solutions?/i, // Solutions
    /\/offres?/i, // Offers
    /\/about/i, // About
    /\/a-propos/i, // About (FR)
    /\/qui-sommes/i, // Who we are (FR)
    /\/contact/i, // Contact
    /\/tarifs?/i, // Pricing
    /\/pricing/i, // Pricing
    /\/expertise/i, // Expertise
    /\/metiers?/i, // Trades (FR)
  ];

  const baseUrlObj = new URL(baseUrl);
  const normalizedUrls = urls.filter((url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  });

  // Sort by priority
  const sorted = normalizedUrls.sort((a, b) => {
    const pathA = new URL(a).pathname;
    const pathB = new URL(b).pathname;

    const priorityA = priorityPatterns.findIndex((p) => p.test(pathA));
    const priorityB = priorityPatterns.findIndex((p) => p.test(pathB));

    // Lower index = higher priority
    if (priorityA !== -1 && priorityB === -1) return -1;
    if (priorityA === -1 && priorityB !== -1) return 1;
    if (priorityA !== -1 && priorityB !== -1) return priorityA - priorityB;

    // For non-priority pages, prefer shorter paths (closer to root)
    return pathA.split("/").length - pathB.split("/").length;
  });

  return sorted.slice(0, maxPages);
}

/**
 * Format the initial analysis report as Markdown
 */
function formatInitialReport(
  aiResult: {
    products: Array<{ name: string; description: string; keywords: string[] }>;
    summary: string;
    recommendations: string[];
  },
  pagesAnalyzed: number
): string {
  const productList = aiResult.products
    .map(
      (p, i) =>
        `### ${i + 1}. ${p.name}\n${
          p.description
        }\n\n**Mots-clés**: ${p.keywords.join(", ")}`
    )
    .join("\n\n");

  const recommendationList = aiResult.recommendations
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  return `# Analyse Initiale

## Résumé
${aiResult.summary}

## Pages Analysées
${pagesAnalyzed} pages ont été analysées pour identifier vos produits et services.

## Produits et Services Identifiés

${productList}

## Recommandations Initiales

${recommendationList}

---
*Ce rapport a été généré automatiquement par l'analyse IA de votre site.*
`;
}

export const analysis = {
  runInitialAnalysis,
};
