import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

// Disable caching for this route
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; queryId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check search query access
async function checkSearchQueryAccess(
  userId: string,
  slug: string,
  websiteId: string,
  queryId: string
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

  const searchQuery = await prisma.searchQuery.findFirst({
    where: {
      id: queryId,
      websiteId,
      website: { organizationId: membership.organizationId },
    },
    include: { website: true },
  });

  return searchQuery;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/queries/:queryId/competitors
 * Get competitors for this search query based on SERP results.
 *
 * Uses SerpResult data directly from the database:
 * - Our positions come from SerpResult with searchQueryId
 * - Competitor positions come from SerpResult with competitorId
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log("[Competitors API] === START === queryId:", queryId);

  const searchQuery = await checkSearchQueryAccess(
    user.id,
    slug,
    websiteId,
    queryId
  );

  console.log(
    "[Competitors API] searchQuery found:",
    searchQuery ? `YES (query: ${searchQuery.query})` : "NO"
  );

  if (!searchQuery) {
    return NextResponse.json(
      { success: false, error: "Search query not found" },
      { status: 404 }
    );
  }

  // Get the search query string
  const queryString = searchQuery.query;
  const queryStringLower = queryString.toLowerCase();

  console.log("[Competitors API] Query string:", queryString);
  console.log("[Competitors API] SearchQuery ID:", queryId);

  // Debug: Get all SERP results related to this searchQueryId to understand the data
  const allOurSerpResults = await prisma.serpResult.findMany({
    where: { searchQueryId: queryId },
    select: { query: true, position: true, createdAt: true },
  });
  console.log(
    `[Competitors API] Found ${allOurSerpResults.length} SERP results for our searchQueryId`
  );
  if (allOurSerpResults.length > 0) {
    console.log(
      `[Competitors API] Sample: query="${allOurSerpResults[0].query}", position=${allOurSerpResults[0].position}`
    );
  }

  // Get all unique query strings from our SERP results
  const ourQueries = [
    ...new Set(allOurSerpResults.map((r) => r.query.toLowerCase())),
  ];
  console.log(
    `[Competitors API] Tracking ${ourQueries.length} unique query strings:`,
    ourQueries
  );

  // Get our latest SERP result for this search query
  const ourLatestSerpResult = await prisma.serpResult.findFirst({
    where: { searchQueryId: queryId },
    orderBy: { createdAt: "desc" },
    select: { position: true, query: true },
  });

  console.log("[Competitors API] Our latest SERP result:", ourLatestSerpResult);

  const ourPosition = ourLatestSerpResult?.position ?? 0;

  // Get all competitors for this website that have SERP results for this exact query
  const websiteCompetitors = await prisma.competitor.findMany({
    where: { websiteId, isActive: true },
    select: { id: true, name: true, url: true, description: true },
  });

  console.log(
    `[Competitors API] Found ${websiteCompetitors.length} competitors for website`
  );

  // Debug: Check how many competitors have SERP results for our tracked queries
  const competitorSerpCount = await prisma.serpResult.count({
    where: {
      competitorId: { in: websiteCompetitors.map((c) => c.id) },
      query: { in: ourQueries },
    },
  });
  console.log(
    `[Competitors API] Found ${competitorSerpCount} competitor SERP results matching our queries`
  );

  // Debug: See what queries competitors actually have
  const competitorQueries = await prisma.serpResult.findMany({
    where: {
      competitorId: { in: websiteCompetitors.map((c) => c.id) },
    },
    select: { query: true },
    distinct: ["query"],
    take: 10,
  });
  console.log(
    `[Competitors API] Sample competitor queries:`,
    competitorQueries.map((r) => r.query)
  );
  console.log(
    `[Competitors API] ⚠️ MISMATCH: We track "${ourQueries[0]}" but competitors have different queries!`
  );

  // For each competitor, get their SERP position for ANY of our tracked queries
  const competitorData = await Promise.all(
    websiteCompetitors.map(async (competitor) => {
      // Get competitor's latest SERP result for any of our tracked queries
      const competitorSerpResult = await prisma.serpResult.findFirst({
        where: {
          competitorId: competitor.id,
          query: {
            in: ourQueries,
          },
        },
        orderBy: { createdAt: "desc" },
        select: { position: true, query: true },
      });

      const competitorPosition = competitorSerpResult?.position ?? 0;

      if (competitorSerpResult) {
        console.log(
          `[Competitors API] ✓ ${competitor.name}: position ${competitorPosition} for "${competitorSerpResult.query}"`
        );
      }

      // Calculate difference based on presence
      let difference: number;
      let weAreBetter: boolean;

      if (ourPosition > 0 && competitorPosition === 0) {
        // We are present, they are not
        difference = 100;
        weAreBetter = true;
      } else if (ourPosition === 0 && competitorPosition > 0) {
        // They are present, we are not
        difference = -100;
        weAreBetter = false;
      } else if (ourPosition > 0 && competitorPosition > 0) {
        // Both present - compare positions
        difference = competitorPosition - ourPosition;
        weAreBetter = ourPosition < competitorPosition;
      } else {
        // Both absent
        difference = 0;
        weAreBetter = false;
      }

      const comparison = competitorSerpResult
        ? [
            {
              keyword: queryString,
              ourPosition,
              competitorPosition,
              difference,
              weAreBetter,
            },
          ]
        : [];

      // Si on a trouvé un SerpResult pour ce concurrent, c'est qu'il partage cette requête
      const sharedKeywords = competitorSerpResult ? 1 : 0;

      return {
        id: competitor.id,
        name: competitor.name,
        url: competitor.url,
        description: competitor.description,
        sharedKeywords,
        totalKeywordsTracked: comparison.length,
        comparison,
        avgDifference: difference,
        threat: difference > 5 ? "low" : difference > 0 ? "medium" : "high",
      };
    })
  );

  // Filter out competitors with no shared keywords (not relevant to this query)
  const relevantCompetitors = competitorData.filter(
    (c) => c.comparison.length > 0
  );

  console.log(
    `[Competitors API] Filtered to ${relevantCompetitors.length} relevant competitors`
  );
  if (relevantCompetitors.length > 0) {
    console.log(
      "[Competitors API] Relevant:",
      relevantCompetitors
        .map((c) => `${c.name} (${c.sharedKeywords} shared)`)
        .join(", ")
    );
  }

  // Sort by threat level (high first) and number of shared keywords
  relevantCompetitors.sort((a, b) => {
    const threatOrder = { high: 0, medium: 1, low: 2 };
    const threatDiff =
      threatOrder[a.threat as keyof typeof threatOrder] -
      threatOrder[b.threat as keyof typeof threatOrder];
    if (threatDiff !== 0) return threatDiff;
    return b.sharedKeywords - a.sharedKeywords;
  });

  return NextResponse.json({
    success: true,
    data: {
      competitors: relevantCompetitors,
      summary: {
        totalCompetitors: relevantCompetitors.length,
        highThreat: relevantCompetitors.filter((c) => c.threat === "high")
          .length,
        mediumThreat: relevantCompetitors.filter((c) => c.threat === "medium")
          .length,
        lowThreat: relevantCompetitors.filter((c) => c.threat === "low").length,
        searchQuery: queryString,
        searchedQueries: [queryString],
      },
    },
  });
});
