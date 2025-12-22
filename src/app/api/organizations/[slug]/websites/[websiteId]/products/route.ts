import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  keywords: z.array(z.string()).min(1).max(20),
  sourceUrl: z.string().url().optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  keywords: z.array(z.string()).max(20).optional(),
  isActive: z.boolean().optional(),
});

// Helper to check access
async function checkWebsiteAccess(
  userId: string,
  orgSlug: string,
  websiteId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug: orgSlug },
    },
    include: { organization: { select: { id: true } } },
  });

  if (!membership) return null;

  const website = await prisma.website.findFirst({
    where: { id: websiteId, organizationId: membership.organization.id },
  });

  if (!website) return null;

  return { website, role: membership.role };
}

// GET /api/organizations/[slug]/websites/[websiteId]/products
export const GET = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const products = await prisma.product.findMany({
      where: {
        websiteId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { serpResults: true, aiSuggestions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        keywords: p.keywords,
        sourceUrl: p.sourceUrl,
        confidence: p.confidence,
        isActive: p.isActive,
        serpCount: p._count.serpResults,
        suggestionCount: p._count.aiSuggestions,
        createdAt: p.createdAt,
      })),
    });
  }
);

// POST /api/organizations/[slug]/websites/[websiteId]/products
export const POST = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = createProductSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        websiteId,
        ...validation.data,
        confidence: 1.0, // Manual creation = 100% confidence
      },
    });

    // Schedule SERP analysis for this product
    await prisma.analysisJob.create({
      data: {
        websiteId,
        type: "serp_analysis",
        payload: { productId: product.id, queries: validation.data.keywords },
        priority: 5,
      },
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  }
);

// We also export a handler for individual products
export { updateProductSchema };
