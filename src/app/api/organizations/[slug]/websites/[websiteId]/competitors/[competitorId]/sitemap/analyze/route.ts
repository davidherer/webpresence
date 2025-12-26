import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import type { ApiResponse } from "@/types";

/**
 * POST /api/organizations/[slug]/websites/[websiteId]/competitors/[competitorId]/sitemap/analyze
 * Lancer l'analyse du sitemap d'un concurrent
 */
export async function POST(
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

    // Get the request body (optional selected sitemaps)
    const body = await request.json();
    const selectedSitemaps = body.selectedSitemaps || [];

    // Create an analysis job for the competitor sitemap
    const job = await prisma.analysisJob.create({
      data: {
        websiteId,
        type: "competitor_sitemap_fetch",
        status: "pending",
        priority: 5,
        payload: {
          competitorId,
          selectedSitemaps,
        },
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        jobId: job.id,
        message: "Competitor sitemap analysis job created",
      },
    });
  } catch (error: any) {
    console.error(
      "[API] Error creating competitor sitemap analysis job:",
      error
    );
    return NextResponse.json<ApiResponse>(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
