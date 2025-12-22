import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

// Schema for creating an organization
const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
});

// GET /api/organizations - List user's organizations
export const GET = withUserAuth(async (req) => {
  const user = (req as typeof req & { user: { id: string } }).user;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: {
      organization: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const organizations = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    serpFrequencyHours: m.organization.serpFrequencyHours,
    competitorFrequencyHours: m.organization.competitorFrequencyHours,
    aiReportFrequencyHours: m.organization.aiReportFrequencyHours,
    createdAt: m.organization.createdAt,
  }));

  return NextResponse.json({ success: true, data: organizations });
});

// POST /api/organizations - Create a new organization
export const POST = withUserAuth(async (req) => {
  const user = (req as typeof req & { user: { id: string } }).user;

  const body = await req.json();
  const validation = createOrgSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0].message },
      { status: 400 }
    );
  }

  const { name, slug } = validation.data;

  // Check if slug is taken
  const existing = await prisma.organization.findUnique({
    where: { slug },
  });

  if (existing) {
    return NextResponse.json(
      { success: false, error: "This slug is already taken" },
      { status: 409 }
    );
  }

  // Create organization and add user as owner
  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: "owner",
      },
    },
    { status: 201 }
  );
});
