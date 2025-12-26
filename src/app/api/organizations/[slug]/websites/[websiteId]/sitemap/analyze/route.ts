import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export async function POST(
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

    // Parse le body pour récupérer les sitemaps sélectionnés
    const body = await request.json().catch(() => ({}));
    const selectedSitemaps = body.selectedSitemaps || [];

    // Créer un job pour analyser le sitemap
    const job = await prisma.analysisJob.create({
      data: {
        websiteId,
        type: "sitemap_fetch",
        payload: {
          selectedSitemaps,
          websiteUrl: website.url,
        },
        priority: 5,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "Sitemap analysis started",
    });
  } catch (error) {
    console.error("Sitemap analyze API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
