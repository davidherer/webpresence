import { prisma } from "@/lib/db";
import { brightdata } from "@/lib/brightdata";
import { storage } from "@/lib/storage";

interface SerpAnalysisResult {
  query: string;
  position: number | null;
  url: string | null;
  competitors: Array<{ url: string; position: number; domain: string }>;
}

/**
 * Run SERP analysis for a product's keywords
 */
export async function runSerpAnalysis(
  websiteId: string,
  productId: string,
  queries: string[]
): Promise<SerpAnalysisResult[]> {
  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!website || !product) {
    throw new Error("Website or product not found");
  }

  const websiteDomain = new URL(website.url).hostname;
  const results: SerpAnalysisResult[] = [];

  for (const query of queries) {
    try {
      console.log(`[SERP] Analyzing query: "${query}"`);

      const serpResponse = await brightdata.searchSerp({
        query,
        country: "fr",
        language: "fr",
        numResults: 20,
      });

      // Store raw SERP data in blob
      const blobResult = await storage.storeSerpData(
        websiteId,
        query,
        serpResponse
      );

      // Find our position
      const ourResult = serpResponse.results.find(
        (r) =>
          r.domain === websiteDomain || r.domain.endsWith(`.${websiteDomain}`)
      );

      // Save SERP result for the product
      await prisma.serpResult.create({
        data: {
          productId,
          query,
          position: ourResult?.position || null,
          url: ourResult?.url || null,
          title: ourResult?.title || null,
          snippet: ourResult?.snippet || null,
          searchEngine: "google",
          country: "FR",
          device: "desktop",
          rawDataBlobUrl: blobResult.url,
        },
      });

      // Identify competitors from SERP
      const competitors = serpResponse.results
        .filter(
          (r) =>
            r.domain !== websiteDomain &&
            !r.domain.endsWith(`.${websiteDomain}`)
        )
        .slice(0, 10)
        .map((r) => ({
          url: r.url,
          position: r.position,
          domain: r.domain,
        }));

      results.push({
        query,
        position: ourResult?.position || null,
        url: ourResult?.url || null,
        competitors,
      });

      // Auto-add top competitors (if not already tracked)
      const topCompetitors = competitors.slice(0, 3);
      for (const comp of topCompetitors) {
        const existing = await prisma.competitor.findFirst({
          where: { websiteId, url: { contains: comp.domain } },
        });

        if (!existing) {
          // Create competitor (will need manual validation)
          await prisma.competitor.create({
            data: {
              websiteId,
              url: `https://${comp.domain}`,
              name: comp.domain,
              description: `Concurrent détecté sur "${query}"`,
            },
          });
        }
      }
    } catch (error) {
      console.error(`[SERP] Error for query "${query}":`, error);
      // Continue with other queries
    }
  }

  return results;
}

/**
 * Run SERP analysis for a competitor (global positioning)
 */
export async function runCompetitorSerpAnalysis(
  websiteId: string,
  competitorId: string,
  queries: string[]
): Promise<void> {
  const competitor = await prisma.competitor.findUnique({
    where: { id: competitorId },
  });

  if (!competitor) {
    throw new Error("Competitor not found");
  }

  const competitorDomain = new URL(competitor.url).hostname;

  for (const query of queries) {
    try {
      const serpResponse = await brightdata.searchSerp({
        query,
        country: "fr",
        language: "fr",
        numResults: 20,
      });

      const blobResult = await storage.storeSerpData(
        websiteId,
        `competitor_${competitorId}_${query}`,
        serpResponse
      );

      const theirResult = serpResponse.results.find(
        (r) =>
          r.domain === competitorDomain ||
          r.domain.endsWith(`.${competitorDomain}`)
      );

      await prisma.serpResult.create({
        data: {
          competitorId,
          query,
          position: theirResult?.position || null,
          url: theirResult?.url || null,
          title: theirResult?.title || null,
          snippet: theirResult?.snippet || null,
          searchEngine: "google",
          country: "FR",
          device: "desktop",
          rawDataBlobUrl: blobResult.url,
        },
      });
    } catch (error) {
      console.error(`[SERP] Competitor error for query "${query}":`, error);
    }
  }
}

export const serp = {
  runSerpAnalysis,
  runCompetitorSerpAnalysis,
};
