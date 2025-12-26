import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

/**
 * POST /api/organizations/[slug]/websites/[websiteId]/competitors/batch-analyze-sitemap
 * Lance des analyses de sitemap pour plusieurs concurrents en batch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; websiteId: string }> }
) {
  try {
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { slug, websiteId } = await params;

    // Verify organization access
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organization: { slug },
      },
      include: { organization: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Verify website access
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organizationId: membership.organization.id,
      },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Site web non trouvé" },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { competitorIds } = body as { competitorIds: string[] };

    if (
      !competitorIds ||
      !Array.isArray(competitorIds) ||
      competitorIds.length === 0
    ) {
      return NextResponse.json(
        { error: "Liste de concurrents invalide" },
        { status: 400 }
      );
    }

    // Verify all competitors belong to this website
    const competitors = await prisma.competitor.findMany({
      where: {
        id: { in: competitorIds },
        websiteId,
        isActive: true,
      },
    });

    if (competitors.length !== competitorIds.length) {
      return NextResponse.json(
        { error: "Certains concurrents sont invalides ou inactifs" },
        { status: 400 }
      );
    }

    // Create analysis jobs for each competitor
    const jobs = await Promise.all(
      competitors.map((competitor) =>
        prisma.analysisJob.create({
          data: {
            type: "competitor_sitemap_fetch",
            status: "pending",
            priority: 2,
            payload: {
              competitorId: competitor.id,
              websiteId,
              organizationId: membership.organization.id,
              competitorUrl: competitor.url,
              competitorName: competitor.name,
            },
            websiteId,
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `${jobs.length} analyse(s) de sitemap créée(s)`,
      jobIds: jobs.map((job) => job.id),
    });
  } catch (error) {
    console.error("Error creating batch sitemap analysis jobs:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création des analyses" },
      { status: 500 }
    );
  }
}
