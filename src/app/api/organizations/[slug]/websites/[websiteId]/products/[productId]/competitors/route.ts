import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

// Disable caching for this route
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
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
 * Get competitors for this product based on SERP results.
 *
 * Uses SerpResult data directly from the database:
 * - Our positions come from SerpResult with productId
 * - Competitor positions come from SerpResult with competitorId
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

  // Get our SERP results for this product
  const ourSerpResults = await prisma.serpResult.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true, createdAt: true },
  });

  // Get unique queries and our latest position for each
  const ourPositionsByKeyword = new Map<string, number | null>();
  for (const result of ourSerpResults) {
    const queryLower = result.query.toLowerCase();
    if (!ourPositionsByKeyword.has(queryLower)) {
      ourPositionsByKeyword.set(queryLower, result.position);
    }
  }

  // Get all competitors for this website
  const websiteCompetitors = await prisma.competitor.findMany({
    where: { websiteId, isActive: true },
    select: { id: true, name: true, url: true, description: true },
  });

  // For each competitor, get their SERP positions
  const competitorData = await Promise.all(
    websiteCompetitors.map(async (competitor) => {
      // Get competitor's SERP results
      const competitorSerpResults = await prisma.serpResult.findMany({
        where: { competitorId: competitor.id },
        orderBy: { createdAt: "desc" },
        select: { query: true, position: true },
      });

      // Build map of competitor's latest position per query
      const theirPositionsByKeyword = new Map<string, number | null>();
      for (const result of competitorSerpResults) {
        const queryLower = result.query.toLowerCase();
        if (!theirPositionsByKeyword.has(queryLower)) {
          theirPositionsByKeyword.set(queryLower, result.position);
        }
      }

      // Get all queries from our product
      const allQueries = [...ourPositionsByKeyword.keys()];

      // Build comparison for queries where we have data
      const comparison = allQueries
        .map((query) => {
          const ourPos = ourPositionsByKeyword.get(query);
          const theirPos = theirPositionsByKeyword.get(query);

          // Handle positions
          const ourPosition = ourPos !== null && ourPos !== undefined && ourPos > 0 ? ourPos : 0;
          const competitorPosition = theirPos !== null && theirPos !== undefined && theirPos > 0 ? theirPos : 0;

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

          return {
            keyword: query,
            ourPosition,
            competitorPosition,
            difference,
            weAreBetter,
          };
        })
        .filter((c) => c.ourPosition > 0 || c.competitorPosition > 0); // Only include if at least one is present

      // Calculate shared keywords (where both have data)
      const sharedKeywords = comparison.filter(
        (c) => c.ourPosition > 0 && c.competitorPosition > 0
      ).length;

      // Average position difference
      const avgDifference =
        comparison.length > 0
          ? comparison.reduce((sum, c) => sum + c.difference, 0) / comparison.length
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
    })
  );

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
        mediumThreat: competitorData.filter((c) => c.threat === "medium").length,
        lowThreat: competitorData.filter((c) => c.threat === "low").length,
        ourKeywords: productKeywords,
        searchedQueries: [...ourPositionsByKeyword.keys()],
      },
    },
  });
});
