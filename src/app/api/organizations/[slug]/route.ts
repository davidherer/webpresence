import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

// Schema for updating an organization
const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  serpFrequencyHours: z.number().min(1).max(720).optional(),
  competitorFrequencyHours: z.number().min(1).max(720).optional(),
  aiReportFrequencyHours: z.number().min(1).max(2160).optional(),
});

// Helper to check user access to organization
async function checkOrgAccess(
  userId: string,
  slug: string,
  requiredRoles?: string[]
): Promise<{
  organization: Awaited<ReturnType<typeof prisma.organization.findUnique>>;
  role: string;
} | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug },
      ...(requiredRoles ? { role: { in: requiredRoles } } : {}),
    },
    include: { organization: true },
  });

  if (!membership) return null;
  return { organization: membership.organization, role: membership.role };
}

// GET /api/organizations/[slug] - Get organization details
export const GET = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    const access = await checkOrgAccess(user.id, slug);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const { organization, role } = access;

    // Get member count and website count
    const [memberCount, websiteCount] = await Promise.all([
      prisma.organizationMember.count({
        where: { organizationId: organization!.id },
      }),
      prisma.website.count({ where: { organizationId: organization!.id } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: organization!.id,
        name: organization!.name,
        slug: organization!.slug,
        role,
        serpFrequencyHours: organization!.serpFrequencyHours,
        competitorFrequencyHours: organization!.competitorFrequencyHours,
        aiReportFrequencyHours: organization!.aiReportFrequencyHours,
        createdAt: organization!.createdAt,
        memberCount,
        websiteCount,
      },
    });
  }
);

// PATCH /api/organizations/[slug] - Update organization
export const PATCH = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    // Only owners and admins can update
    const access = await checkOrgAccess(user.id, slug, ["owner", "admin"]);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = updateOrgSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.organization.update({
      where: { id: access.organization!.id },
      data: validation.data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        serpFrequencyHours: updated.serpFrequencyHours,
        competitorFrequencyHours: updated.competitorFrequencyHours,
        aiReportFrequencyHours: updated.aiReportFrequencyHours,
      },
    });
  }
);

// DELETE /api/organizations/[slug] - Delete organization
export const DELETE = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    // Only owner can delete
    const access = await checkOrgAccess(user.id, slug, ["owner"]);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Only the owner can delete the organization" },
        { status: 403 }
      );
    }

    await prisma.organization.delete({
      where: { id: access.organization!.id },
    });

    return NextResponse.json({ success: true });
  }
);
