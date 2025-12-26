import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { list } from "@vercel/blob";

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

    // Récupérer le dernier snapshot
    const latestSnapshot = await prisma.sitemapSnapshot.findFirst({
      where: { websiteId },
      orderBy: { fetchedAt: "desc" },
    });

    if (!latestSnapshot) {
      return NextResponse.json({
        urls: [],
        totalCount: 0,
        hasMore: false,
        lastFetch: null,
      });
    }

    // Pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Récupérer les données du sitemap depuis Blob
    const response = await fetch(latestSnapshot.blobUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch sitemap from blob storage");
    }

    const sitemapData = await response.json();
    const allUrls = sitemapData.urls || [];

    // Récupérer les URLs déjà analysées
    const analyzedUrls = await prisma.pageAnalysis.findMany({
      where: {
        websiteId,
        url: { in: allUrls.map((u: any) => u.loc || u.url) },
      },
      select: {
        url: true,
        createdAt: true,
      },
    });

    const analyzedMap = new Map(analyzedUrls.map((a) => [a.url, a.createdAt]));

    // Enrichir les URLs avec le statut d'analyse
    const enrichedUrls = allUrls.map((urlData: any) => {
      const url = urlData.loc || urlData.url;
      const lastAnalyzed = analyzedMap.get(url);
      return {
        url,
        lastmod: urlData.lastmod,
        changefreq: urlData.changefreq,
        priority: urlData.priority,
        isAnalyzed: !!lastAnalyzed,
        lastAnalyzed: lastAnalyzed?.toISOString(),
      };
    });

    // Paginer
    const paginatedUrls = enrichedUrls.slice(offset, offset + limit);
    const hasMore = offset + limit < enrichedUrls.length;

    return NextResponse.json({
      urls: paginatedUrls,
      totalCount: enrichedUrls.length,
      hasMore,
      lastFetch: latestSnapshot.fetchedAt.toISOString(),
    });
  } catch (error) {
    console.error("Sitemap GET API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
