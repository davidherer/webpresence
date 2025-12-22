import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { runSerpAnalysis } from "@/lib/analysis/serp";

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
 * GET /api/organizations/:slug/websites/:websiteId/queries/:queryId/serp
 * Get SERP history for a search query (formatted for charts)
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
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

  // Get query params for filtering
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get SERP results
  const serpResults = await prisma.serpResult.findMany({
    where: {
      searchQueryId: queryId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date for chart data
  const chartData: Record<string, { date: string; position: number | null }> =
    {};

  for (const result of serpResults) {
    const dateKey = result.createdAt.toISOString().split("T")[0];
    if (!chartData[dateKey]) {
      chartData[dateKey] = { date: dateKey, position: result.position };
    }
  }

  // Calculate stats
  const latestResult =
    serpResults.length > 0 ? serpResults[serpResults.length - 1] : null;
  const previousResult =
    serpResults.length > 1 ? serpResults[serpResults.length - 2] : null;

  let trend: "up" | "down" | "stable" | "absent" = "stable";
  let change: number | null = null;

  if (latestResult?.position === null) {
    trend = "absent";
  } else if (
    latestResult &&
    previousResult &&
    previousResult.position !== null &&
    latestResult.position !== null
  ) {
    change = previousResult.position - latestResult.position;
    trend = change > 0 ? "up" : change < 0 ? "down" : "stable";
  }

  return NextResponse.json({
    success: true,
    data: {
      chartData: Object.values(chartData),
      query: searchQuery.query,
      stats: {
        currentPosition: latestResult?.position ?? null,
        change,
        trend,
      },
      totalResults: serpResults.length,
      period: { days, since: since.toISOString() },
    },
  });
});

/**
 * POST /api/organizations/:slug/websites/:websiteId/queries/:queryId/serp
 * Trigger SERP analysis for a search query
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[SERP POST] Starting for query ${queryId}, user ${user.id}`);

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

  // Get body for force option
  let forceCancel = false;
  try {
    const body = await req.json();
    if (body.force === true) {
      forceCancel = true;
    }
  } catch {
    // No body
  }

  // Check if there's already a pending job for this search query
  const pendingJobs = await prisma.analysisJob.findMany({
    where: {
      websiteId,
      type: "serp_analysis",
      status: { in: ["pending", "running"] },
      payload: { path: ["searchQueryId"], equals: queryId },
    },
  });

  if (pendingJobs.length > 0) {
    if (forceCancel) {
      await prisma.analysisJob.updateMany({
        where: {
          id: { in: pendingJobs.map((j) => j.id) },
        },
        data: {
          status: "cancelled",
          error: "Cancelled by user (force mode)",
        },
      });
    } else {
      const pendingJob = pendingJobs[0];
      return NextResponse.json(
        {
          success: false,
          error:
            "SERP analysis already in progress. Use force=true to cancel and restart.",
          existingJob: {
            id: pendingJob.id,
            status: pendingJob.status,
            createdAt: pendingJob.createdAt,
          },
        },
        { status: 409 }
      );
    }
  }

  // Create job
  const job = await prisma.analysisJob.create({
    data: {
      websiteId,
      type: "serp_analysis",
      payload: { searchQueryId: queryId, query: searchQuery.query },
      priority: 8, // High priority for manual trigger
    },
  });

  // In development, run immediately
  if (process.env.NODE_ENV === "development") {
    runSerpAnalysis(websiteId, queryId, [searchQuery.query])
      .then(() => {
        console.log(`[SERP POST] SERP analysis completed for query ${queryId}`);
      })
      .catch((error) => {
        console.error(
          `[SERP POST] SERP analysis failed for query ${queryId}:`,
          error
        );
      });
  }

  return NextResponse.json({
    success: true,
    data: {
      jobId: job.id,
      message: "SERP analysis triggered",
      query: searchQuery.query,
      cancelledJobs: forceCancel ? pendingJobs.length : 0,
    },
  });
});
