import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

interface SerpResultFromBlob {
  position: number;
  url: string;
  domain: string;
  title: string;
  description: string;
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
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/competitors
 * Get competitors for this product based on SERP results (dynamic deduction)
 *
 * A competitor is identified when they appear in SERP results for the same keywords
 * as this product. We extract competitor positions from stored SERP blobs.
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

  // Get product's keywords
  const productKeywords = product.keywords;

  // Get our SERP results for this product (with blob URLs)
  const ourSerpResults = await prisma.serpResult.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });

  // Get unique queries we've searched (take most recent for each query)
  const uniqueQueries = new Map<string, (typeof ourSerpResults)[0]>();
  for (const result of ourSerpResults) {
    if (!uniqueQueries.has(result.query)) {
      uniqueQueries.set(result.query, result);
    }
  }

  // Get our latest position per keyword
  const ourPositionsByKeyword: Record<string, number | null> = {};
  for (const [query, result] of uniqueQueries) {
    ourPositionsByKeyword[query] = result.position;
  }

  // Find competitors from the website
  const websiteCompetitors = await prisma.competitor.findMany({
    where: { websiteId, isActive: true },
  });

  // Build a map of competitor positions per keyword by reading from stored SERP blobs
  const competitorPositions: Record<string, Record<string, number>> = {};

  // Initialize for each competitor
  for (const comp of websiteCompetitors) {
    const normalizedDomain = new URL(comp.url).hostname.replace(/^www\./, "");
    competitorPositions[normalizedDomain] = {};
  }

  // Read SERP data from blobs and extract competitor positions
  for (const [query, serpResult] of uniqueQueries) {
    if (!serpResult.rawDataBlobUrl) continue;

    try {
      const response = await fetch(serpResult.rawDataBlobUrl);
      if (!response.ok) continue;

      const serpData = await response.json();
      if (!serpData.results || !Array.isArray(serpData.results)) continue;

      // Extract positions for each competitor
      for (const result of serpData.results as SerpResultFromBlob[]) {
        const normalizedResultDomain = result.domain.replace(/^www\./, "");

        // Check if this domain matches any of our competitors
        for (const comp of websiteCompetitors) {
          const normalizedCompDomain = new URL(comp.url).hostname.replace(
            /^www\./,
            ""
          );

          if (
            normalizedResultDomain === normalizedCompDomain ||
            normalizedResultDomain.endsWith(`.${normalizedCompDomain}`)
          ) {
            competitorPositions[normalizedCompDomain][query] = result.position;
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching SERP blob for "${query}":`, error);
    }
  }

  // Build competitor data with position comparison
  const competitorData = websiteCompetitors.map((competitor) => {
    const normalizedDomain = new URL(competitor.url).hostname.replace(
      /^www\./,
      ""
    );
    const positionsByKeyword = competitorPositions[normalizedDomain] || {};

    // Get all keywords where either we or competitor have data
    const allSearchedQueries = [...uniqueQueries.keys()];

    // Build comparison for all keywords where the competitor appears
    // OR where we have a position (to show when competitor is absent)
    const comparison = allSearchedQueries
      .filter((kw) => {
        const ourPos = ourPositionsByKeyword[kw];
        const theirPos = positionsByKeyword[kw];
        // Include if competitor is present OR if we are present (to show complete picture)
        return (
          theirPos !== undefined ||
          (ourPos !== null && ourPos !== undefined && ourPos > 0)
        );
      })
      .map((kw) => {
        const ourPos = ourPositionsByKeyword[kw];
        const theirPos = positionsByKeyword[kw];

        // Handle absent cases (position 0 means "absent")
        const ourPosition =
          ourPos !== null && ourPos !== undefined && ourPos > 0 ? ourPos : 0;
        const competitorPosition = theirPos !== undefined ? theirPos : 0;

        // Calculate difference based on presence
        let difference: number;
        let weAreBetter: boolean;

        if (ourPosition > 0 && competitorPosition === 0) {
          // We are present, they are not - we are much better
          difference = 100; // Big positive = we are better
          weAreBetter = true;
        } else if (ourPosition === 0 && competitorPosition > 0) {
          // They are present, we are not - they are much better
          difference = -100; // Big negative = they are better
          weAreBetter = false;
        } else if (ourPosition > 0 && competitorPosition > 0) {
          // Both present - compare positions
          difference = competitorPosition - ourPosition; // Positive = we are better (lower position)
          weAreBetter = ourPosition < competitorPosition;
        } else {
          // Both absent (shouldn't happen due to filter, but just in case)
          difference = 0;
          weAreBetter = false;
        }

        return {
          keyword: kw,
          ourPosition,
          competitorPosition,
          difference,
          weAreBetter,
        };
      });

    // Calculate shared keywords (where both have data)
    const sharedKeywords = comparison.filter(
      (c) => c.ourPosition > 0 && c.competitorPosition > 0
    ).length;

    // Average position difference (considers absent as very bad)
    const avgDifference =
      comparison.length > 0
        ? comparison.reduce((sum, c) => sum + c.difference, 0) /
          comparison.length
        : 0;

    return {
      id: competitor.id,
      name: competitor.name,
      url: competitor.url,
      description: competitor.description,
      sharedKeywords,
      totalKeywordsTracked: comparison.length,
      comparison,
      avgDifference,
      threat: avgDifference > 5 ? "low" : avgDifference > 0 ? "medium" : "high",
    };
  });

  // Sort by threat level (high first) and number of shared keywords
  competitorData.sort((a, b) => {
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
      competitors: competitorData,
      summary: {
        totalCompetitors: competitorData.length,
        highThreat: competitorData.filter((c) => c.threat === "high").length,
        mediumThreat: competitorData.filter((c) => c.threat === "medium")
          .length,
        lowThreat: competitorData.filter((c) => c.threat === "low").length,
        ourKeywords: productKeywords,
        searchedQueries: [...uniqueQueries.keys()],
      },
    },
  });
});
