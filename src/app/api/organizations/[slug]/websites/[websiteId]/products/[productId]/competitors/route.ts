import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

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
 * Get competitors for this product based on SERP results (dynamic deduction)
 *
 * A competitor is identified when they appear in SERP results for the same keywords
 * as this product.
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
  });

  // Get unique queries we've searched
  const searchedQueries = [...new Set(ourSerpResults.map((r) => r.query))];

  // Find competitors from the same website that have SERP results for similar keywords
  const websiteCompetitors = await prisma.competitor.findMany({
    where: { websiteId },
    include: {
      serpResults: {
        where: {
          query: { in: searchedQueries },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  // Build competitor data with position comparison
  const competitorData = websiteCompetitors.map((competitor) => {
    // Get latest position per keyword for this competitor
    const positionsByKeyword: Record<
      string,
      { position: number; date: string }
    > = {};

    for (const result of competitor.serpResults) {
      if (result.position === null) continue;
      if (
        !positionsByKeyword[result.query] ||
        new Date(result.createdAt) >
          new Date(positionsByKeyword[result.query].date)
      ) {
        positionsByKeyword[result.query] = {
          position: result.position,
          date: result.createdAt.toISOString(),
        };
      }
    }

    // Get our latest position per keyword for comparison
    const ourPositionsByKeyword: Record<string, number> = {};
    for (const result of ourSerpResults) {
      if (!ourPositionsByKeyword[result.query] && result.position !== null) {
        ourPositionsByKeyword[result.query] = result.position;
      }
    }

    // Calculate overlap and comparison
    const sharedKeywords = Object.keys(positionsByKeyword).filter(
      (kw) => ourPositionsByKeyword[kw] !== undefined
    );

    const comparison = sharedKeywords.map((kw) => ({
      keyword: kw,
      ourPosition: ourPositionsByKeyword[kw],
      competitorPosition: positionsByKeyword[kw].position,
      difference: ourPositionsByKeyword[kw] - positionsByKeyword[kw].position,
      weAreBetter: ourPositionsByKeyword[kw] < positionsByKeyword[kw].position,
    }));

    // Average position difference
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
      sharedKeywords: sharedKeywords.length,
      totalKeywordsTracked: Object.keys(positionsByKeyword).length,
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

  // TODO: In a future version, we could also find potential competitors from SERP results
  // that aren't registered yet - domains that appear in top positions but we haven't added as competitors

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
        searchedQueries,
      },
    },
  });
});
