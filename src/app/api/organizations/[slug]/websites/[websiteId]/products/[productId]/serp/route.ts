import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { runSerpAnalysis } from "@/lib/analysis/serp";

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
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/serp
 * Get SERP history for a product (formatted for charts)
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

  // Get query params for filtering
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const keyword = url.searchParams.get("keyword");

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get SERP results
  const serpResults = await prisma.serpResult.findMany({
    where: {
      productId,
      createdAt: { gte: since },
      ...(keyword ? { query: { contains: keyword, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by date and keyword for chart data
  const chartData: Record<
    string,
    { date: string; [keyword: string]: number | string }
  > = {};

  for (const result of serpResults) {
    const dateKey = result.createdAt.toISOString().split("T")[0];
    if (!chartData[dateKey]) {
      chartData[dateKey] = { date: dateKey };
    }
    if (result.position !== null) {
      chartData[dateKey][result.query] = result.position;
    }
  }

  // Get unique keywords
  const keywords = [...new Set(serpResults.map((r) => r.query))];

  // Calculate stats
  const latestByKeyword: Record<
    string,
    { position: number; change: number; trend: "up" | "down" | "stable" }
  > = {};

  for (const kw of keywords) {
    const kwResults = serpResults.filter((r) => r.query === kw);
    if (kwResults.length > 0) {
      const latest = kwResults[kwResults.length - 1];
      const previous =
        kwResults.length > 1 ? kwResults[kwResults.length - 2] : null;
      const latestPos = latest.position ?? 0;
      const previousPos = previous?.position ?? latestPos;
      const change = previousPos - latestPos;

      latestByKeyword[kw] = {
        position: latestPos,
        change,
        trend: change > 0 ? "up" : change < 0 ? "down" : "stable",
      };
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      chartData: Object.values(chartData),
      keywords,
      stats: latestByKeyword,
      totalResults: serpResults.length,
      period: { days, since: since.toISOString() },
    },
  });
});

/**
 * POST /api/organizations/:slug/websites/:websiteId/products/:productId/serp
 * Trigger SERP analysis for a product
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[SERP POST] Starting for product ${productId}, user ${user.id}`);
  console.log(`[SERP POST] Params: slug=${slug}, websiteId=${websiteId}`);

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  console.log(`[SERP POST] Product access check:`, product ? `found: ${product.name}` : "NOT FOUND");
  
  if (!product) {
    console.log(`[SERP POST] 404 - Product not found`);
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  // Get body for custom queries (optional) and force option
  let queries = product.keywords.slice(0, 5);
  let forceCancel = false;
  console.log(`[SERP POST] Default keywords:`, queries);
  
  try {
    const body = await req.json();
    console.log(`[SERP POST] Request body:`, body);
    if (body.queries && Array.isArray(body.queries)) {
      queries = body.queries.slice(0, 10); // Max 10 queries
      console.log(`[SERP POST] Using custom queries:`, queries);
    }
    if (body.force === true) {
      forceCancel = true;
      console.log(`[SERP POST] Force mode enabled`);
    }
  } catch {
    console.log(`[SERP POST] No body or invalid JSON, using default keywords`);
  }

  // Check if there's already a pending job for this product
  console.log(`[SERP POST] Checking for pending jobs...`);
  const pendingJobs = await prisma.analysisJob.findMany({
    where: {
      websiteId,
      type: "serp_analysis",
      status: { in: ["pending", "running"] },
      payload: { path: ["productId"], equals: productId },
    },
  });

  console.log(`[SERP POST] Pending jobs found:`, pendingJobs.length);

  if (pendingJobs.length > 0) {
    if (forceCancel) {
      // Cancel all pending jobs
      console.log(`[SERP POST] Force cancelling ${pendingJobs.length} pending job(s)...`);
      await prisma.analysisJob.updateMany({
        where: {
          id: { in: pendingJobs.map(j => j.id) },
        },
        data: {
          status: "cancelled",
          error: "Cancelled by user (force mode)",
        },
      });
      console.log(`[SERP POST] Jobs cancelled successfully`);
    } else {
      const pendingJob = pendingJobs[0];
      console.log(`[SERP POST] 409 - Job already in progress: ${pendingJob.id}, status: ${pendingJob.status}`);
      return NextResponse.json(
        { 
          success: false, 
          error: "SERP analysis already in progress. Use force=true to cancel and restart.",
          existingJob: {
            id: pendingJob.id,
            status: pendingJob.status,
            createdAt: pendingJob.createdAt,
          }
        },
        { status: 409 }
      );
    }
  }

  if (queries.length === 0) {
    console.log(`[SERP POST] 400 - No keywords available`);
    return NextResponse.json(
      { success: false, error: "No keywords available for this product" },
      { status: 400 }
    );
  }

  // Create job
  console.log(`[SERP POST] Creating analysis job...`);
  const job = await prisma.analysisJob.create({
    data: {
      websiteId,
      type: "serp_analysis",
      payload: { productId, queries },
      priority: 8, // High priority for manual trigger
    },
  });
  console.log(`[SERP POST] Job created: ${job.id}`);

  // In development, run immediately
  if (process.env.NODE_ENV === "development") {
    console.log(`[SERP POST] DEV mode - running SERP analysis immediately...`);
    runSerpAnalysis(websiteId, productId, queries)
      .then(() => {
        console.log(`[SERP POST] SERP analysis completed for product ${productId}`);
      })
      .catch((error) => {
        console.error(`[SERP POST] SERP analysis failed for product ${productId}:`, error);
      });
  }

  console.log(`[SERP POST] Success - returning job info`);
  return NextResponse.json({
    success: true,
    data: {
      jobId: job.id,
      message: "SERP analysis triggered",
      queries,
      cancelledJobs: forceCancel ? pendingJobs.length : 0,
    },
  });
});
