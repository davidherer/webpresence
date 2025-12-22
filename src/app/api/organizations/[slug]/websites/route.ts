import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string }> };

const createWebsiteSchema = z.object({
  url: z.string().url("URL invalide"),
  name: z.string().min(1).max(100),
});

// Helper to check user access to organization
async function checkOrgAccess(
  userId: string,
  slug: string
): Promise<{ organizationId: string; role: string } | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug },
    },
    include: { organization: { select: { id: true } } },
  });

  if (!membership) return null;
  return { organizationId: membership.organization.id, role: membership.role };
}

// GET /api/organizations/[slug]/websites - List websites
export const GET = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    const access = await checkOrgAccess(user.id, slug);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const websites = await prisma.website.findMany({
      where: { organizationId: access.organizationId },
      include: {
        _count: {
          select: {
            products: true,
            competitors: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: websites.map((w) => ({
        id: w.id,
        url: w.url,
        name: w.name,
        status: w.status,
        sitemapUrl: w.sitemapUrl,
        lastSitemapFetch: w.lastSitemapFetch,
        productCount: w._count.products,
        competitorCount: w._count.competitors,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  }
);

// POST /api/organizations/[slug]/websites - Create website
export const POST = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug } = await context.params;

    const access = await checkOrgAccess(user.id, slug);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = createWebsiteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { url, name } = validation.data;

    // Normalize URL (remove trailing slash, ensure https)
    const normalizedUrl = url.replace(/\/$/, "").replace(/^http:/, "https:");

    // Check if website already exists for this org
    const existing = await prisma.website.findUnique({
      where: {
        organizationId_url: {
          organizationId: access.organizationId,
          url: normalizedUrl,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "This website already exists in your organization",
        },
        { status: 409 }
      );
    }

    // Create website
    const website = await prisma.website.create({
      data: {
        organizationId: access.organizationId,
        url: normalizedUrl,
        name,
        status: "pending",
      },
    });

    // Schedule initial analysis job
    await prisma.analysisJob.create({
      data: {
        websiteId: website.id,
        type: "initial_analysis",
        status: "pending",
        priority: 10, // High priority for new websites
      },
    });

    // In development, trigger analysis immediately without waiting for cron
    if (process.env.NODE_ENV === "development") {
      const analysis = await import("@/lib/analysis/initial");
      analysis.runInitialAnalysis(website.id).catch((error) => {
        console.error(
          `[DEV] Failed to auto-start analysis for website ${website.id}:`,
          error
        );
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: website.id,
          url: website.url,
          name: website.name,
          status: website.status,
        },
      },
      { status: 201 }
    );
  }
);
