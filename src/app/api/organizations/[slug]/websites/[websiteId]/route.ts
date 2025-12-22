import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

const updateWebsiteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// Helper to check user access to website
async function checkWebsiteAccess(
  userId: string,
  orgSlug: string,
  websiteId: string
): Promise<{
  website: Awaited<ReturnType<typeof prisma.website.findUnique>>;
  role: string;
} | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug: orgSlug },
    },
    include: { organization: { select: { id: true } } },
  });

  if (!membership) return null;

  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organization.id,
    },
  });

  if (!website) return null;

  return { website, role: membership.role };
}

// GET /api/organizations/[slug]/websites/[websiteId] - Get website details
export const GET = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    const { website } = access;

    // Get related counts
    const [queryCount, competitorCount, reportCount, pendingJobs] =
      await Promise.all([
        prisma.searchQuery.count({ where: { websiteId: website!.id } }),
        prisma.competitor.count({ where: { websiteId: website!.id } }),
        prisma.aIReport.count({ where: { websiteId: website!.id } }),
        prisma.analysisJob.count({
          where: {
            websiteId: website!.id,
            status: { in: ["pending", "running"] },
          },
        }),
      ]);

    // Get latest report
    const latestReport = await prisma.aIReport.findFirst({
      where: { websiteId: website!.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, title: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: website!.id,
        url: website!.url,
        name: website!.name,
        status: website!.status,
        sitemapUrl: website!.sitemapUrl,
        lastSitemapFetch: website!.lastSitemapFetch,
        queryCount,
        competitorCount,
        reportCount,
        pendingJobs,
        latestReport,
        createdAt: website!.createdAt,
        updatedAt: website!.updatedAt,
      },
    });
  }
);

// PATCH /api/organizations/[slug]/websites/[websiteId] - Update website
export const PATCH = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = updateWebsiteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const updated = await prisma.website.update({
      where: { id: websiteId },
      data: validation.data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        url: updated.url,
        name: updated.name,
        status: updated.status,
      },
    });
  }
);

// DELETE /api/organizations/[slug]/websites/[websiteId] - Delete website
export const DELETE = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);

    if (!access) {
      return NextResponse.json(
        { success: false, error: "Website not found" },
        { status: 404 }
      );
    }

    // Only owners and admins can delete
    if (!["owner", "admin"].includes(access.role)) {
      return NextResponse.json(
        { success: false, error: "Not authorized to delete" },
        { status: 403 }
      );
    }

    await prisma.website.delete({
      where: { id: websiteId },
    });

    return NextResponse.json({ success: true });
  }
);
