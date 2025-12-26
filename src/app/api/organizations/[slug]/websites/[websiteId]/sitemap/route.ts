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

    // Pagination
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Récupérer le dernier snapshot pour les métadonnées
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

    // Récupérer les URLs depuis la table SitemapUrl (données en base)
    const totalCount = await prisma.sitemapUrl.count({
      where: { snapshotId: latestSnapshot.id },
    });

    const sitemapUrls = await prisma.sitemapUrl.findMany({
      where: { snapshotId: latestSnapshot.id },
      select: {
        url: true,
        lastmod: true,
        changefreq: true,
        priority: true,
      },
      orderBy: { url: "asc" },
      skip: offset,
      take: limit,
    });

    // Récupérer les URLs déjà analysées pour les enrichir
    const urlList = sitemapUrls.map((u) => u.url);
    const analyzedUrls = await prisma.pageExtraction.findMany({
      where: {
        websiteId,
        url: { in: urlList },
      },
      select: {
        url: true,
        status: true,
        type: true,
        extractedAt: true,
      },
    });

    const analyzedMap = new Map(
      analyzedUrls.map((a) => [
        a.url,
        {
          status: a.status,
          type: a.type,
          extractedAt: a.extractedAt,
        },
      ])
    );

    // Formater les URLs
    const enrichedUrls = sitemapUrls.map((sitemapUrl) => {
      const analyzed = analyzedMap.get(sitemapUrl.url);
      return {
        url: sitemapUrl.url,
        lastmod: sitemapUrl.lastmod,
        changefreq: sitemapUrl.changefreq,
        priority: sitemapUrl.priority,
        isAnalyzed: analyzed?.status === "completed" && analyzed?.type !== null,
        lastAnalyzed: analyzed?.extractedAt?.toISOString(),
        status: analyzed?.status,
        type: analyzed?.type,
      };
    });

    const hasMore = offset + limit < totalCount;

    return NextResponse.json({
      urls: enrichedUrls,
      totalCount,
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
