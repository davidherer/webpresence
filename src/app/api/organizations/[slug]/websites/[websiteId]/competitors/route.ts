import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

const createCompetitorSchema = z.object({
  url: z.string().url("URL invalide"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const updateCompetitorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
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

// GET /api/organizations/[slug]/websites/[websiteId]/competitors
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

    const competitors = await prisma.competitor.findMany({
      where: {
        websiteId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: { serpResults: true, pageAnalyses: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: competitors.map((c) => ({
        id: c.id,
        url: c.url,
        name: c.name,
        description: c.description,
        isActive: c.isActive,
        serpCount: c._count.serpResults,
        pageAnalysisCount: c._count.pageAnalyses,
        createdAt: c.createdAt,
      })),
    });
  }
);

// POST /api/organizations/[slug]/websites/[websiteId]/competitors
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
    const validation = createCompetitorSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { url, name, description } = validation.data;

    // Normalize URL
    const normalizedUrl = url.replace(/\/$/, "").replace(/^http:/, "https:");

    // Check if competitor already exists
    const existing = await prisma.competitor.findUnique({
      where: {
        websiteId_url: { websiteId, url: normalizedUrl },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This competitor already exists" },
        { status: 409 }
      );
    }

    const competitor = await prisma.competitor.create({
      data: {
        websiteId,
        url: normalizedUrl,
        name,
        description,
      },
    });

    // Schedule page scraping for this competitor
    await prisma.analysisJob.create({
      data: {
        websiteId,
        type: "page_scrape",
        payload: { competitorId: competitor.id, urls: [normalizedUrl] },
        priority: 5,
      },
    });

    return NextResponse.json(
      { success: true, data: competitor },
      { status: 201 }
    );
  }
);

export { updateCompetitorSchema };
