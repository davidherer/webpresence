import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

// Disable caching for this route
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; competitorId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check website access
async function checkWebsiteAccess(
  userId: string,
  slug: string,
  websiteId: string
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

  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organizationId,
    },
  });

  return website;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/competitors/:competitorId/score
 * Get the SERP comparison score for a competitor
 *
 * Compares our positions (from SerpResult with searchQueryId) with competitor positions
 * (from SerpResult with competitorId) on the same queries.
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, competitorId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const website = await checkWebsiteAccess(user.id, slug, websiteId);
  if (!website) {
    return NextResponse.json(
      { success: false, error: "Website not found" },
      { status: 404 }
    );
  }

  const competitor = await prisma.competitor.findFirst({
    where: {
      id: competitorId,
      websiteId,
    },
  });

  if (!competitor) {
    return NextResponse.json(
      { success: false, error: "Competitor not found" },
      { status: 404 }
    );
  }

  // Get our latest SERP positions (from search queries) - group by query to get latest
  const ourResults = await prisma.serpResult.findMany({
    where: {
      searchQuery: { websiteId, isActive: true },
      searchQueryId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      query: true,
      position: true,
      createdAt: true,
    },
  });

  // Build a map of our latest position per query
  const ourPositions = new Map<string, number | null>();
  for (const result of ourResults) {
    const queryLower = result.query.toLowerCase();
    if (!ourPositions.has(queryLower)) {
      ourPositions.set(queryLower, result.position);
    }
  }

  // Get competitor's latest SERP positions
  const competitorResults = await prisma.serpResult.findMany({
    where: {
      competitorId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      query: true,
      position: true,
      createdAt: true,
    },
  });

  // Build a map of competitor's latest position per query
  const theirPositions = new Map<string, number | null>();
  for (const result of competitorResults) {
    const queryLower = result.query.toLowerCase();
    if (!theirPositions.has(queryLower)) {
      theirPositions.set(queryLower, result.position);
    }
  }

  // Compare positions on common queries
  let better = 0;
  let worse = 0;
  let total = 0;

  // Get all unique queries from both sets
  const allQueries = new Set([
    ...ourPositions.keys(),
    ...theirPositions.keys(),
  ]);

  for (const query of allQueries) {
    const ourPos = ourPositions.get(query);
    const theirPos = theirPositions.get(query);

    const weArePresent = ourPos !== null && ourPos !== undefined && ourPos > 0;
    const theyArePresent =
      theirPos !== null && theirPos !== undefined && theirPos > 0;

    // Only count if at least one is present
    if (weArePresent || theyArePresent) {
      total++;

      if (weArePresent && !theyArePresent) {
        better++;
      } else if (!weArePresent && theyArePresent) {
        worse++;
      } else if (weArePresent && theyArePresent) {
        if (ourPos! < theirPos!) {
          better++;
        } else if (ourPos! > theirPos!) {
          worse++;
        }
        // Equal positions don't count as better or worse
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { better, worse, total },
  });
});
