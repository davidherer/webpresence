import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

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
 * GET /api/organizations/:slug/websites/:websiteId/competitors/:competitorId
 * Get a single competitor
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

  return NextResponse.json({
    success: true,
    data: competitor,
  });
});

/**
 * PATCH /api/organizations/:slug/websites/:websiteId/competitors/:competitorId
 * Update a competitor
 */
export const PATCH = withUserAuth<RouteContext>(async (req, { params }) => {
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

  const body = await req.json();
  const { name, url, description, isActive } = body;

  const updated = await prisma.competitor.update({
    where: { id: competitorId },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(description !== undefined && { description }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/organizations/:slug/websites/:websiteId/competitors/:competitorId
 * Delete a competitor (remove from tracking)
 */
export const DELETE = withUserAuth<RouteContext>(async (req, { params }) => {
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

  // Delete associated SERP results first
  await prisma.serpResult.deleteMany({
    where: { competitorId },
  });

  // Delete the competitor
  await prisma.competitor.delete({
    where: { id: competitorId },
  });

  return NextResponse.json({
    success: true,
    message: "Competitor deleted",
  });
});
