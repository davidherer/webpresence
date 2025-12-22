import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const user = await getUserSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check access
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organization: { slug },
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { organization, role } = membership;

    // Fetch websites with stats
    const websites = await prisma.website.findMany({
      where: { organizationId: organization.id },
      include: {
        _count: {
          select: { searchQueries: true, competitors: true, aiReports: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch members
    const members = await prisma.organizationMember.findMany({
      where: { organizationId: organization.id },
      include: { user: { select: { email: true, name: true } } },
    });

    return NextResponse.json({
      organization,
      role,
      websites,
      members,
    });
  } catch (error) {
    console.error("Organization dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
