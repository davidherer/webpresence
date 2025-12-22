import { prisma } from "@/lib/db";
import { brightdata } from "@/lib/brightdata";
import { mistral } from "@/lib/mistral";
import { storage } from "@/lib/storage";

interface InitialAnalysisResult {
  success: boolean;
  searchQueriesIdentified: number;
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

    console.log(`[Analysis] 🚀 Starting initial analysis for ${website.name}`);

    // Step 1: Fetch sitemap
    console.log(`[Analysis] Step 1/7: Fetching sitemap for ${website.url}`);
    const sitemap = await brightdata.fetchSitemap(website.url);

    console.log(
      `[Analysis] ✓ Sitemap fetched - ${sitemap.urls.length} URLs found`
    );

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

    // Step 2: Select key pages to analyze (just homepage for initial analysis)
    console.log(`[Analysis] Step 2/7: Selecting key pages to analyze...`);
    const urlsToAnalyze = selectKeyPages(
      sitemap.urls.map((u) => u.loc),
      website.url,
      1
    );

    console.log(
      `[Analysis] ✓ Selected ${urlsToAnalyze.length} page(s) to analyze`
    );

    // Step 3: Scrape and analyze each page
    console.log(`[Analysis] Step 3/7: Scraping pages...`);
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

    console.log(
      `[Analysis] ✓ Successfully scraped ${pageContents.length} page(s)`
    );

    // Step 4: Use AI to identify search queries
    console.log(
      `[Analysis] Step 4/7: Running AI analysis (identifying search queries)...`
    );
    const aiResult = await mistral.identifySearchQueries(
      website.name,
      website.url,
      pageContents
    );

    console.log(
      `[Analysis] ✓ AI analysis completed - ${aiResult.searchQueries.length} search query(ies) identified`
    );

    // Step 5: Save identified search queries
    console.log(`[Analysis] Step 5/7: Saving identified search queries...`);
    const createdSearchQueries: string[] = [];
    for (const sq of aiResult.searchQueries) {
      const created = await prisma.searchQuery.create({
        data: {
          websiteId,
          description: sq.description,
          query: sq.query,
          tags: sq.tags || [],
          competitionLevel: sq.competitionLevel,
          confidence: sq.confidence,
        },
      });
      createdSearchQueries.push(created.id);
    }

    console.log(
      `[Analysis] ✓ Saved ${createdSearchQueries.length} search query(ies) to database`
    );

    // Step 6: Save AI report
    console.log(`[Analysis] Step 6/7: Generating analysis report...`);
    await prisma.aIReport.create({
      data: {
        websiteId,
        type: "initial_analysis",
        title: `Analyse initiale de ${website.name}`,
        content: formatInitialReport(aiResult, pageContents.length),
        metadata: {
          pagesAnalyzed: pageContents.length,
          searchQueriesIdentified: aiResult.searchQueries.length,
          recommendations: aiResult.recommendations,
        },
      },
    });

    console.log(`[Analysis] ✓ Analysis report saved`);

    // Step 7: Schedule SERP analysis jobs for each search query
    console.log(`[Analysis] Step 7/7: Scheduling SERP analysis jobs...`);
    for (const searchQueryId of createdSearchQueries) {
      const searchQuery = await prisma.searchQuery.findUnique({
        where: { id: searchQueryId },
      });
      if (searchQuery) {
        await prisma.analysisJob.create({
          data: {
            websiteId,
            type: "serp_analysis",
            payload: {
              searchQueryId,
              query: searchQuery.query,
            },
            priority: 5,
          },
        });
      }
    }

    console.log(
      `[Analysis] ✓ Scheduled ${createdSearchQueries.length} SERP analysis job(s)`
    );

    // Update website status to active
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "active" },
    });

    console.log(
      `[Analysis] ✅ Initial analysis completed successfully - ${aiResult.searchQueries.length} search queries, ${pageContents.length} pages analyzed`
    );

    return {
      success: true,
      searchQueriesIdentified: aiResult.searchQueries.length,
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
      searchQueriesIdentified: 0,
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
    searchQueries: Array<{
      description: string;
      query: string;
      tags: string[];
      competitionLevel: string;
    }>;
    summary: string;
    recommendations: string[];
  },
  pagesAnalyzed: number
): string {
  const queryList = aiResult.searchQueries
    .map(
      (sq, i) =>
        `### ${i + 1}. ${sq.query}\n${sq.description}\n\n**Tags**: ${
          sq.tags.length > 0 ? sq.tags.join(", ") : "Aucun"
        } | **Concurrence**: ${
          sq.competitionLevel === "HIGH" ? "Forte" : "Longue traîne"
        }`
    )
    .join("\n\n");

  const recommendationList = aiResult.recommendations
    .map((r, i) => `${i + 1}. ${r}`)
    .join("\n");

  return `# Analyse Initiale

## Résumé
${aiResult.summary}

## Pages Analysées
${pagesAnalyzed} pages ont été analysées pour identifier les requêtes de recherche pertinentes.

## Requêtes de Recherche Identifiées

${queryList}

## Recommandations Initiales

${recommendationList}

---
*Ce rapport a été généré automatiquement par l'analyse IA de votre site.*
`;
}

export const analysis = {
  runInitialAnalysis,
};
