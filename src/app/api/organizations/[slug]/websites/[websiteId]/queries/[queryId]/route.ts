import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; queryId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

const updateSearchQuerySchema = z.object({
  description: z.string().max(1000).optional(),
  query: z.string().min(1).max(200).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
  competitionLevel: z.enum(["HIGH", "LOW"]).optional(),
  isActive: z.boolean().optional(),
});

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
 * GET /api/organizations/:slug/websites/:websiteId/queries/:queryId
 * Get a single search query
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[SearchQuery GET] Fetching query ${queryId}`);

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

  return NextResponse.json({
    success: true,
    data: searchQuery,
  });
});

/**
 * PATCH /api/organizations/:slug/websites/:websiteId/queries/:queryId
 * Update a search query (title, description, query, competitionLevel, isActive)
 */
export const PATCH = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[SearchQuery PATCH] Updating query ${queryId}`);

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

  // Parse and validate body
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validation = updateSearchQuerySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation error",
        details: validation.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { description, query, tags, competitionLevel, isActive } =
    validation.data;

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (description !== undefined) updateData.description = description;
  if (query !== undefined) updateData.query = query;
  if (tags !== undefined) updateData.tags = tags;
  if (competitionLevel !== undefined)
    updateData.competitionLevel = competitionLevel;
  if (isActive !== undefined) updateData.isActive = isActive;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: "No fields to update" },
      { status: 400 }
    );
  }

  console.log(`[SearchQuery PATCH] Updating with:`, updateData);

  const updated = await prisma.searchQuery.update({
    where: { id: queryId },
    data: updateData,
  });

  console.log(`[SearchQuery PATCH] Updated successfully`);

  return NextResponse.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/organizations/:slug/websites/:websiteId/queries/:queryId
 * Delete a search query
 */
export const DELETE = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[SearchQuery DELETE] Deleting query ${queryId}`);

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

  // Delete related data first (cascade)
  await prisma.$transaction([
    prisma.aISuggestion.deleteMany({ where: { searchQueryId: queryId } }),
    prisma.serpResult.deleteMany({ where: { searchQueryId: queryId } }),
    prisma.searchQuery.delete({ where: { id: queryId } }),
  ]);

  console.log(`[SearchQuery DELETE] Deleted successfully`);

  return NextResponse.json({
    success: true,
    message: "Search query deleted",
  });
});
