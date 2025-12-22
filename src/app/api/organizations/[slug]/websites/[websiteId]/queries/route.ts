import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

const createSearchQuerySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  query: z.string().min(1).max(200),
  competitionLevel: z.enum(["HIGH", "LOW"]).default("HIGH"),
});

const updateSearchQuerySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  query: z.string().min(1).max(200).optional(),
  competitionLevel: z.enum(["HIGH", "LOW"]).optional(),
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

// GET /api/organizations/[slug]/websites/[websiteId]/queries
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

    const searchQueries = await prisma.searchQuery.findMany({
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
      data: searchQueries.map((sq) => ({
        id: sq.id,
        title: sq.title,
        description: sq.description,
        query: sq.query,
        competitionLevel: sq.competitionLevel,
        confidence: sq.confidence,
        isActive: sq.isActive,
        serpCount: sq._count.serpResults,
        suggestionCount: sq._count.aiSuggestions,
        createdAt: sq.createdAt,
      })),
    });
  }
);

// POST /api/organizations/[slug]/websites/[websiteId]/queries
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
    const validation = createSearchQuerySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const searchQuery = await prisma.searchQuery.create({
      data: {
        websiteId,
        ...validation.data,
        confidence: 1.0, // Manual creation = 100% confidence
      },
    });

    // Schedule SERP analysis for this search query
    await prisma.analysisJob.create({
      data: {
        websiteId,
        type: "serp_analysis",
        payload: {
          searchQueryId: searchQuery.id,
          query: validation.data.query,
        },
        priority: 5,
      },
    });

    return NextResponse.json(
      { success: true, data: searchQuery },
      { status: 201 }
    );
  }
);

// We also export a handler for individual search queries
export { updateSearchQuerySchema };
