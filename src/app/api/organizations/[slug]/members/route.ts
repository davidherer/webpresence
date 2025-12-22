import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

// Helper to check user access to organization
async function checkOrgAccess(
  userId: string,
  slug: string,
  requiredRoles?: string[]
): Promise<{ organizationId: string; role: string } | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug },
      ...(requiredRoles ? { role: { in: requiredRoles } } : {}),
    },
    include: { organization: { select: { id: true } } },
  });

  if (!membership) return null;
  return { organizationId: membership.organization.id, role: membership.role };
}

// GET /api/organizations/[slug]/members - List members
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

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: access.organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        createdAt: m.createdAt,
      })),
    });
  }
);

// POST /api/organizations/[slug]/members - Add member
export const POST = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    // Only owners and admins can add members
    const access = await checkOrgAccess(user.id, slug, ["owner", "admin"]);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = addMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, role } = validation.data;

    // Find user by email
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found. They must create an account first.",
        },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: access.organizationId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "User is already a member" },
        { status: 409 }
      );
    }

    // Add member
    const member = await prisma.organizationMember.create({
      data: {
        organizationId: access.organizationId,
        userId: targetUser.id,
        role,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: member.id,
          userId: member.user.id,
          email: member.user.email,
          name: member.user.name,
          role: member.role,
        },
      },
      { status: 201 }
    );
  }
);
