import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { brightdata } from "@/lib/brightdata";

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

    // Utiliser BrightData pour scraper le sitemap
    const sitemapUrls = [
      new URL("/sitemap.xml", website.url).href,
      new URL("/sitemap_index.xml", website.url).href,
      new URL("/sitemap/sitemap.xml", website.url).href,
    ];

    let sitemapContent = "";
    let foundSitemapUrl = "";

    // Essayer les URLs standards
    for (const sitemapUrl of sitemapUrls) {
      try {
        const result = await brightdata.scrapePage({
          url: sitemapUrl,
          timeout: 15000,
        });

        if (
          result.html.includes("<urlset") ||
          result.html.includes("<sitemapindex")
        ) {
          sitemapContent = result.html;
          foundSitemapUrl = sitemapUrl;
          break;
        }
      } catch {
        // Continue avec la prochaine URL
      }
    }

    // Si pas trouvé, essayer robots.txt
    if (!sitemapContent) {
      try {
        const robotsResult = await brightdata.scrapePage({
          url: new URL("/robots.txt", website.url).href,
          timeout: 10000,
        });

        const sitemapMatch = robotsResult.html.match(/Sitemap:\s*(\S+)/i);
        if (sitemapMatch) {
          const customSitemapUrl = sitemapMatch[1];
          const result = await brightdata.scrapePage({ url: customSitemapUrl });
          sitemapContent = result.html;
          foundSitemapUrl = customSitemapUrl;
        }
      } catch (err) {
        console.error("Failed to fetch robots.txt:", err);
      }
    }

    if (!sitemapContent || !foundSitemapUrl) {
      return NextResponse.json(
        {
          error: "No sitemap found",
          type: "none",
        },
        { status: 404 }
      );
    }

    // Vérifier si c'est un sitemap index
    if (sitemapContent.includes("<sitemapindex")) {
      // Parser les sous-sitemaps
      const locPattern = /<loc>([^<]+)<\/loc>/g;
      const lastmodPattern = /<lastmod>([^<]+)<\/lastmod>/g;

      const locMatches = [...sitemapContent.matchAll(locPattern)];
      const lastmodMatches = [...sitemapContent.matchAll(lastmodPattern)];

      const sitemaps = locMatches.map((match, index) => ({
        loc: match[1],
        lastmod: lastmodMatches[index]?.[1],
      }));

      return NextResponse.json({
        type: "index",
        sitemapUrl: foundSitemapUrl,
        sitemaps,
        totalSitemaps: sitemaps.length,
      });
    } else {
      // Sitemap simple
      return NextResponse.json({
        type: "single",
        sitemapUrl: foundSitemapUrl,
      });
    }
  } catch (error) {
    console.error("Sitemap detect API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
