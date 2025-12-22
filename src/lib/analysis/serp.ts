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
 * Run SERP analysis for a search query
 */
export async function runSerpAnalysis(
  websiteId: string,
  searchQueryId: string,
  queries: string[]
): Promise<SerpAnalysisResult[]> {
  console.log(`[SERP runSerpAnalysis] ===== Starting SERP analysis =====`);
  console.log(`[SERP runSerpAnalysis] websiteId: ${websiteId}`);
  console.log(`[SERP runSerpAnalysis] searchQueryId: ${searchQueryId}`);
  console.log(
    `[SERP runSerpAnalysis] queries: ${queries.length} queries`,
    queries
  );

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const searchQuery = await prisma.searchQuery.findUnique({
    where: { id: searchQueryId },
  });

  if (!website || !searchQuery) {
    console.error(
      `[SERP runSerpAnalysis] ❌ Website or search query not found`
    );
    throw new Error("Website or search query not found");
  }

  console.log(
    `[SERP runSerpAnalysis] Website: ${website.name} (${website.url})`
  );
  console.log(`[SERP runSerpAnalysis] Search Query: ${searchQuery.query}`);

  const websiteDomain = new URL(website.url).hostname;
  // Normalize domain (remove www.) for comparison
  const ourDomain = websiteDomain.replace(/^www\./, "");
  console.log(
    `[SERP runSerpAnalysis] Looking for domain: ${websiteDomain} (normalized: ${ourDomain})`
  );

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

      // Log all domains for debugging
      console.log(
        `[SERP runSerpAnalysis] All domains in results:`,
        serpResponse.results.map((r) => r.domain)
      );

      // Store raw SERP data in blob
      console.log(`[SERP runSerpAnalysis] Storing SERP data in blob...`);
      const blobResult = await storage.storeSerpData(
        websiteId,
        query,
        serpResponse
      );
      console.log(`[SERP runSerpAnalysis] Blob stored at: ${blobResult.url}`);

      // Find our position (normalize domains for comparison)
      const ourResult = serpResponse.results.find((r) => {
        const resultDomain = r.domain.replace(/^www\./, "");
        return (
          resultDomain === ourDomain || resultDomain.endsWith(`.${ourDomain}`)
        );
      });

      console.log(
        `[SERP runSerpAnalysis] Our position:`,
        ourResult ? `#${ourResult.position} (${ourResult.url})` : "NOT FOUND"
      );

      // Save SERP result for the search query
      console.log(`[SERP runSerpAnalysis] Saving SERP result to database...`);
      await prisma.serpResult.create({
        data: {
          searchQueryId,
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
        .filter((r) => {
          const resultDomain = r.domain.replace(/^www\./, "");
          // Exclude if it's our domain (exact match or subdomain)
          const isOurDomain =
            resultDomain === ourDomain ||
            resultDomain.endsWith(`.${ourDomain}`);
          return !isOurDomain;
        })
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
 * Re-analyze stored SERP data without calling BrightData
 * This is useful to re-extract competitors after fixing domain matching
 * Also updates our own positions if they were missed
 */
export async function reanalyzeSerpFromBlob(
  websiteId: string,
  searchQueryId: string
): Promise<{
  reanalyzed: number;
  positionsUpdated: number;
  competitorsFound: number;
  competitorsAdded: number;
}> {
  console.log(`[SERP reanalyzeSerpFromBlob] Starting re-analysis...`);

  const website = await prisma.website.findUnique({ where: { id: websiteId } });
  const searchQuery = await prisma.searchQuery.findUnique({
    where: { id: searchQueryId },
  });

  if (!website || !searchQuery) {
    throw new Error("Website or search query not found");
  }

  const websiteDomain = new URL(website.url).hostname;
  const normalizedWebsiteDomain = websiteDomain.replace(/^www\./, "");

  console.log(
    `[SERP reanalyzeSerpFromBlob] Website domain: ${normalizedWebsiteDomain}`
  );

  // Get all SERP results with blob URLs
  const serpResults = await prisma.serpResult.findMany({
    where: {
      searchQueryId,
      rawDataBlobUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(
    `[SERP reanalyzeSerpFromBlob] Found ${serpResults.length} SERP results to re-analyze`
  );

  let positionsUpdated = 0;
  let competitorsFound = 0;
  let competitorsAdded = 0;

  // Process unique queries (take most recent for each)
  const uniqueQueries = new Map<string, (typeof serpResults)[0]>();
  for (const result of serpResults) {
    if (!uniqueQueries.has(result.query)) {
      uniqueQueries.set(result.query, result);
    }
  }

  for (const [query, serpResult] of uniqueQueries) {
    if (!serpResult.rawDataBlobUrl) continue;

    try {
      console.log(
        `[SERP reanalyzeSerpFromBlob] Re-analyzing "${query}" from ${serpResult.rawDataBlobUrl}`
      );

      // Fetch stored SERP data from blob
      const response = await fetch(serpResult.rawDataBlobUrl);
      if (!response.ok) {
        console.error(
          `[SERP reanalyzeSerpFromBlob] Failed to fetch blob: ${response.status}`
        );
        continue;
      }

      const serpData = await response.json();

      if (!serpData.results || !Array.isArray(serpData.results)) {
        console.error(`[SERP reanalyzeSerpFromBlob] Invalid SERP data format`);
        continue;
      }

      console.log(
        `[SERP reanalyzeSerpFromBlob] Loaded ${serpData.results.length} results from blob`
      );
      console.log(
        `[SERP reanalyzeSerpFromBlob] All domains:`,
        serpData.results.map((r: { domain: string }) => r.domain)
      );

      // Find our position with normalized domain matching
      const ourResult = serpData.results.find(
        (r: {
          domain: string;
          position: number;
          url: string;
          title?: string;
        }) => {
          const normalizedResultDomain = r.domain.replace(/^www\./, "");
          return (
            normalizedResultDomain === normalizedWebsiteDomain ||
            normalizedResultDomain.endsWith(`.${normalizedWebsiteDomain}`)
          );
        }
      );

      console.log(
        `[SERP reanalyzeSerpFromBlob] Our position for "${query}":`,
        ourResult ? `#${ourResult.position} (${ourResult.url})` : "NOT FOUND"
      );
      console.log(
        `[SERP reanalyzeSerpFromBlob] Current DB position:`,
        serpResult.position
      );

      // Update position if different
      if (
        ourResult &&
        (serpResult.position !== ourResult.position || !serpResult.url)
      ) {
        console.log(
          `[SERP reanalyzeSerpFromBlob] Updating position from ${serpResult.position} to ${ourResult.position}`
        );
        await prisma.serpResult.update({
          where: { id: serpResult.id },
          data: {
            position: ourResult.position,
            url: ourResult.url,
            title: ourResult.title || serpResult.title,
          },
        });
        positionsUpdated++;
      } else if (!ourResult && serpResult.position !== null) {
        // We thought we had a position but actually don't
        console.log(
          `[SERP reanalyzeSerpFromBlob] Clearing incorrect position ${serpResult.position}`
        );
        await prisma.serpResult.update({
          where: { id: serpResult.id },
          data: {
            position: null,
            url: null,
          },
        });
        positionsUpdated++;
      }

      // Re-identify competitors with improved filtering
      const competitors = serpData.results.filter(
        (r: { domain: string; position: number; url: string }) => {
          const normalizedResultDomain = r.domain.replace(/^www\./, "");
          const isOurDomain =
            normalizedResultDomain === normalizedWebsiteDomain ||
            normalizedResultDomain.endsWith(`.${normalizedWebsiteDomain}`);

          if (isOurDomain) {
            console.log(
              `[SERP reanalyzeSerpFromBlob] Excluding our domain: ${r.domain}`
            );
          }
          return !isOurDomain;
        }
      );

      competitorsFound += competitors.length;

      // Add top 3 competitors
      const topCompetitors = competitors.slice(0, 3);
      for (const comp of topCompetitors) {
        const normalizedCompDomain = comp.domain.replace(/^www\./, "");

        // Check if already exists
        const existing = await prisma.competitor.findFirst({
          where: {
            websiteId,
            OR: [
              { url: { contains: normalizedCompDomain } },
              { url: { contains: `www.${normalizedCompDomain}` } },
            ],
          },
        });

        if (!existing) {
          console.log(
            `[SERP reanalyzeSerpFromBlob] Adding new competitor: ${normalizedCompDomain} (position ${comp.position})`
          );
          await prisma.competitor.create({
            data: {
              websiteId,
              url: `https://${comp.domain}`,
              name: normalizedCompDomain,
              description: `Concurrent détecté sur "${query}" (position ${comp.position})`,
            },
          });
          competitorsAdded++;
        }
      }
    } catch (error) {
      console.error(
        `[SERP reanalyzeSerpFromBlob] Error re-analyzing "${query}":`,
        error
      );
    }
  }

  console.log(`[SERP reanalyzeSerpFromBlob] ===== Re-analysis complete =====`);
  console.log(
    `[SERP reanalyzeSerpFromBlob] Queries re-analyzed: ${uniqueQueries.size}`
  );
  console.log(
    `[SERP reanalyzeSerpFromBlob] Positions updated: ${positionsUpdated}`
  );
  console.log(
    `[SERP reanalyzeSerpFromBlob] Competitors found: ${competitorsFound}`
  );
  console.log(
    `[SERP reanalyzeSerpFromBlob] Competitors added: ${competitorsAdded}`
  );

  return {
    reanalyzed: uniqueQueries.size,
    positionsUpdated,
    competitorsFound,
    competitorsAdded,
  };
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
