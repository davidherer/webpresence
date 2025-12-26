import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import type { ApiResponse } from "@/types";

/**
 * GET /api/organizations/[slug]/websites/[websiteId]/competitors/[competitorId]/sitemap/history
 * Récupérer l'historique des snapshots du sitemap d'un concurrent
 */
export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ slug: string; websiteId: string; competitorId: string }>;
  }
) {
  try {
    const { slug, websiteId, competitorId } = await params;
    const user = await getUserSession();

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
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
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify website ownership
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organizationId: membership.organization.id,
      },
    });

    if (!website) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    // Verify competitor ownership
    const competitor = await prisma.competitor.findFirst({
      where: {
        id: competitorId,
        websiteId,
      },
    });

    if (!competitor) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Competitor not found" },
        { status: 404 }
      );
    }

    // Get all snapshots
    const snapshots = await prisma.competitorSitemapSnapshot.findMany({
      where: { competitorId },
      orderBy: { fetchedAt: "desc" },
      select: {
        id: true,
        sitemapUrl: true,
        urlCount: true,
        fetchedAt: true,
        sitemapType: true,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: snapshots.map((s) => ({
        ...s,
        fetchedAt: s.fetchedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[API] Error fetching competitor sitemap history:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
