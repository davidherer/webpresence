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

    // Vérifier que le website appartient à l'organisation
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organizationId: membership.organization.id,
      },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    // Récupérer tous les snapshots
    const snapshots = await prisma.sitemapSnapshot.findMany({
      where: { websiteId },
      orderBy: { fetchedAt: "desc" },
      take: 20, // Limiter à 20 snapshots max
    });

    return NextResponse.json({
      snapshots: snapshots.map((s) => ({
        id: s.id,
        sitemapUrl: s.sitemapUrl,
        urlCount: s.urlCount,
        fetchedAt: s.fetchedAt.toISOString(),
        sitemapType: s.sitemapType,
      })),
    });
  } catch (error) {
    console.error("Sitemap history API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
