import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { reanalyzeSerpFromBlob } from "@/lib/analysis/serp";

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
 * POST /api/organizations/:slug/websites/:websiteId/products/:productId/serp/reanalyze
 * Re-analyze stored SERP data to re-extract competitors (without calling BrightData)
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  try {
    console.log(
      `[SERP Reanalyze POST] Starting re-analysis for product ${productId}`
    );

    const result = await reanalyzeSerpFromBlob(websiteId, productId);

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
