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

async function computeCompetitorScore(competitorId: string, websiteId: string) {
  // Get our latest SERP positions
  const ourResults = await prisma.serpResult.findMany({
    where: {
      searchQuery: { websiteId, isActive: true },
      searchQueryId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      query: true,
      position: true,
    },
  });

  const ourPositions = new Map<string, number | null>();
  for (const result of ourResults) {
    const queryLower = result.query.toLowerCase();
    if (!ourPositions.has(queryLower)) {
      ourPositions.set(queryLower, result.position);
    }
  }

  // Get competitor's latest SERP positions
  const competitorResults = await prisma.serpResult.findMany({
    where: { competitorId },
    orderBy: { createdAt: "desc" },
    select: {
      query: true,
      position: true,
    },
  });

  const theirPositions = new Map<string, number | null>();
  for (const result of competitorResults) {
    const queryLower = result.query.toLowerCase();
    if (!theirPositions.has(queryLower)) {
      theirPositions.set(queryLower, result.position);
    }
  }

  // Compare positions
  let better = 0;
  let worse = 0;
  let total = 0;

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
      }
    }
  }

  return { better, worse, total, netScore: better - worse };
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
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const sortBy = url.searchParams.get("sortBy") || "score"; // 'score' or 'name'
    const sortOrder = url.searchParams.get("sortOrder") || "desc"; // 'asc' or 'desc'

    // Get all competitors
    const competitors = await prisma.competitor.findMany({
      where: {
        websiteId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      select: {
        id: true,
        name: true,
        url: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Compute scores for all competitors
    const competitorsWithScores = await Promise.all(
      competitors.map(async (competitor) => {
        const score = await computeCompetitorScore(competitor.id, websiteId);
        return {
          ...competitor,
          score,
        };
      })
    );

    // Sort competitors
    competitorsWithScores.sort((a, b) => {
      if (sortBy === "score") {
        const diff = b.score.netScore - a.score.netScore;
        return sortOrder === "desc" ? diff : -diff;
      } else {
        // Sort by name
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === "desc" ? -comparison : comparison;
      }
    });

    // Paginate
    const skip = (page - 1) * limit;
    const paginatedCompetitors = competitorsWithScores.slice(
      skip,
      skip + limit
    );

    return NextResponse.json({
      success: true,
      data: paginatedCompetitors,
      totalCount: competitorsWithScores.length,
      hasMore: skip + limit < competitorsWithScores.length,
      page,
      limit,
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
