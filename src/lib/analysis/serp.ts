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
  console.log(`[SERP runSerpAnalysis] ===== Starting SERP analysis =====`);
  console.log(`[SERP runSerpAnalysis] websiteId: ${websiteId}`);
  console.log(`[SERP runSerpAnalysis] productId: ${productId}`);
  console.log(
    `[SERP runSerpAnalysis] queries: ${queries.length} queries`,
    queries
  );

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!website || !product) {
    console.error(`[SERP runSerpAnalysis] ❌ Website or product not found`);
    throw new Error("Website or product not found");
  }

  console.log(
    `[SERP runSerpAnalysis] Website: ${website.name} (${website.url})`
  );
  console.log(`[SERP runSerpAnalysis] Product: ${product.name}`);

  const websiteDomain = new URL(website.url).hostname;
  console.log(`[SERP runSerpAnalysis] Looking for domain: ${websiteDomain}`);

  const results: SerpAnalysisResult[] = [];

  for (const query of queries) {
    try {
      console.log(
        `[SERP runSerpAnalysis] ===== Processing query: "${query}" =====`
      );

      const serpResponse = await brightdata.searchSerp({
        query,
        country: "fr",
        language: "fr",
        numResults: 20,
      });

      console.log(
        `[SERP runSerpAnalysis] Received ${serpResponse.results.length} results from BrightData`
      );

      // Store raw SERP data in blob
      console.log(`[SERP runSerpAnalysis] Storing SERP data in blob...`);
      const blobResult = await storage.storeSerpData(
        websiteId,
        query,
        serpResponse
      );
      console.log(`[SERP runSerpAnalysis] Blob stored at: ${blobResult.url}`);

      // Find our position
      const ourResult = serpResponse.results.find(
        (r) =>
          r.domain === websiteDomain || r.domain.endsWith(`.${websiteDomain}`)
      );

      console.log(
        `[SERP runSerpAnalysis] Our position:`,
        ourResult ? `#${ourResult.position} (${ourResult.url})` : "NOT FOUND"
      );

      // Save SERP result for the product
      console.log(`[SERP runSerpAnalysis] Saving SERP result to database...`);
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
      console.log(`[SERP runSerpAnalysis] ✅ SERP result saved`);

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

      console.log(
        `[SERP runSerpAnalysis] Found ${competitors.length} competitors`
      );

      results.push({
        query,
        position: ourResult?.position || null,
        url: ourResult?.url || null,
        competitors,
      });

      // Auto-add top competitors (if not already tracked)
      const topCompetitors = competitors.slice(0, 3);
      console.log(
        `[SERP runSerpAnalysis] Checking top ${topCompetitors.length} competitors...`
      );

      for (const comp of topCompetitors) {
        const existing = await prisma.competitor.findFirst({
          where: { websiteId, url: { contains: comp.domain } },
        });

        if (!existing) {
          console.log(
            `[SERP runSerpAnalysis] Adding new competitor: ${comp.domain}`
          );
          // Create competitor (will need manual validation)
          await prisma.competitor.create({
            data: {
              websiteId,
              url: `https://${comp.domain}`,
              name: comp.domain,
              description: `Concurrent détecté sur "${query}"`,
            },
          });
          console.log(`[SERP runSerpAnalysis] ✅ Competitor added`);
        } else {
          console.log(
            `[SERP runSerpAnalysis] Competitor ${comp.domain} already exists`
          );
        }
      }

      console.log(`[SERP runSerpAnalysis] ✅ Query "${query}" completed`);
    } catch (error) {
      console.error(
        `[SERP runSerpAnalysis] ❌ Error for query "${query}":`,
        error
      );
      console.error(
        `[SERP runSerpAnalysis] Error stack:`,
        error instanceof Error ? error.stack : "N/A"
      );
      // Continue with other queries
    }
  }

  console.log(
    `[SERP runSerpAnalysis] ===== Analysis complete - ${results.length}/${queries.length} queries successful =====`
  );
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
