import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { reanalyzeSerpFromBlob } from "@/lib/analysis/serp";

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
 * POST /api/organizations/:slug/websites/:websiteId/queries/:queryId/serp/reanalyze
 * Re-analyze stored SERP data to re-extract competitors (without calling BrightData)
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const searchQuery = await checkSearchQueryAccess(
    user.id,
    slug,
    websiteId,
    queryId
  );
  if (!searchQuery) {
    return NextResponse.json(
      { success: false, error: "Search query not found" },
      { status: 404 }
    );
  }

  try {
    console.log(
      `[SERP Reanalyze POST] Starting re-analysis for search query ${queryId}`
    );

    const result = await reanalyzeSerpFromBlob(websiteId, queryId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[SERP Reanalyze POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to re-analyze SERP data" },
      { status: 500 }
    );
  }
});
