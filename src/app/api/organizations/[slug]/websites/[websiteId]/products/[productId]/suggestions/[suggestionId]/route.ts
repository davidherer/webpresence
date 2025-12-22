import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

interface RouteContext {
  params: Promise<{
    slug: string;
    websiteId: string;
    productId: string;
    suggestionId: string;
  }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check suggestion access
async function checkSuggestionAccess(
  userId: string,
  slug: string,
  websiteId: string,
  productId: string,
  suggestionId: string
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

  const suggestion = await prisma.aISuggestion.findFirst({
    where: {
      id: suggestionId,
      productId,
      product: {
        websiteId,
        website: { organizationId: membership.organizationId },
      },
    },
    include: { product: true },
  });

  return suggestion;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/suggestions/:suggestionId
 * Get a specific suggestion
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId, suggestionId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const suggestion = await checkSuggestionAccess(
    user.id,
    slug,
    websiteId,
    productId,
    suggestionId
  );

  if (!suggestion) {
    return NextResponse.json(
      { success: false, error: "Suggestion not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: suggestion,
  });
});

/**
 * PATCH /api/organizations/:slug/websites/:websiteId/products/:productId/suggestions/:suggestionId
 * Update suggestion status (accept/dismiss)
 */
export const PATCH = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId, suggestionId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const suggestion = await checkSuggestionAccess(
    user.id,
    slug,
    websiteId,
    productId,
    suggestionId
  );

  if (!suggestion) {
    return NextResponse.json(
      { success: false, error: "Suggestion not found" },
      { status: 404 }
    );
  }

  const body = await req.json();
  const { status } = body;

  if (!status || !["pending", "accepted", "dismissed"].includes(status)) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid status. Must be pending, accepted, or dismissed",
      },
      { status: 400 }
    );
  }

  const updated = await prisma.aISuggestion.update({
    where: { id: suggestionId },
    data: { status },
  });

  return NextResponse.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/organizations/:slug/websites/:websiteId/products/:productId/suggestions/:suggestionId
 * Delete a suggestion
 */
export const DELETE = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId, suggestionId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const suggestion = await checkSuggestionAccess(
    user.id,
    slug,
    websiteId,
    productId,
    suggestionId
  );

  if (!suggestion) {
    return NextResponse.json(
      { success: false, error: "Suggestion not found" },
      { status: 404 }
    );
  }

  await prisma.aISuggestion.delete({
    where: { id: suggestionId },
  });

  return NextResponse.json({
    success: true,
    message: "Suggestion deleted",
  });
});
