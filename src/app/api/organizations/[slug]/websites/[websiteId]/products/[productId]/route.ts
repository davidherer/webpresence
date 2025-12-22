import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  keywords: z.array(z.string().min(1).max(100)).max(20).optional(),
  isActive: z.boolean().optional(),
  sourceUrl: z.string().url().optional().nullable(),
});

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
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId
 * Get a single product
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[Product GET] Fetching product ${productId}`);

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    data: product,
  });
});

/**
 * PATCH /api/organizations/:slug/websites/:websiteId/products/:productId
 * Update a product (name, description, keywords, isActive)
 */
export const PATCH = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[Product PATCH] Updating product ${productId}`);

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
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

  const validation = updateProductSchema.safeParse(body);
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

  const { name, description, keywords, isActive, sourceUrl } = validation.data;

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (keywords !== undefined) updateData.keywords = keywords;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: "No fields to update" },
      { status: 400 }
    );
  }

  console.log(`[Product PATCH] Updating with:`, updateData);

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
  });

  console.log(`[Product PATCH] Updated successfully`);

  return NextResponse.json({
    success: true,
    data: updated,
  });
});

/**
 * DELETE /api/organizations/:slug/websites/:websiteId/products/:productId
 * Delete a product
 */
export const DELETE = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  console.log(`[Product DELETE] Deleting product ${productId}`);

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  // Delete related data first (cascade)
  await prisma.$transaction([
    prisma.aISuggestion.deleteMany({ where: { productId } }),
    prisma.serpResult.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);

  console.log(`[Product DELETE] Deleted successfully`);

  return NextResponse.json({
    success: true,
    message: "Product deleted",
  });
});
