import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; websiteId: string }> }
) {
  try {
    const { slug, websiteId } = await params;
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
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch website
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organizationId: membership.organization.id,
      },
      include: {
        searchQueries: {
          where: { isActive: true },
          include: {
            serpResults: {
              orderBy: { createdAt: "desc" },
              take: 2,
            },
            _count: {
              select: { aiSuggestions: { where: { status: "pending" } } },
            },
          },
        },
        competitors: {
          where: { isActive: true },
          include: {
            serpResults: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
        aiReports: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    return NextResponse.json({ website });
  } catch (error) {
    console.error("Website dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
