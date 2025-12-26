import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import type { ApiResponse } from "@/types";

/**
 * GET /api/organizations/[slug]/websites/[websiteId]/competitors/[competitorId]/sitemap
 * Récupérer le dernier snapshot du sitemap d'un concurrent
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

    // Get the latest snapshot
    const latestSnapshot = await prisma.competitorSitemapSnapshot.findFirst({
      where: { competitorId },
      orderBy: { fetchedAt: "desc" },
    });

    if (!latestSnapshot) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "No sitemap snapshot found" },
        { status: 404 }
      );
    }

    // Fetch the sitemap data from blob storage
    const response = await fetch(latestSnapshot.blobUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch sitemap from blob storage");
    }

    const sitemapData = await response.json();
    const allUrls = sitemapData.urls || [];

    // Pagination
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const paginatedUrls = allUrls.slice(offset, offset + limit);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        snapshot: {
          id: latestSnapshot.id,
          sitemapUrl: latestSnapshot.sitemapUrl,
          urlCount: latestSnapshot.urlCount,
          fetchedAt: latestSnapshot.fetchedAt.toISOString(),
          sitemapType: latestSnapshot.sitemapType,
        },
        urls: paginatedUrls,
        pagination: {
          page,
          limit,
          total: allUrls.length,
          hasMore: offset + limit < allUrls.length,
        },
      },
    });
  } catch (error: any) {
    console.error("[API] Error fetching competitor sitemap:", error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
