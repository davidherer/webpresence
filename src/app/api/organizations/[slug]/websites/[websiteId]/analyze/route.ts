import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { analysis } from "@/lib/analysis";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

// Helper to check user access to website
async function checkWebsiteAccess(
  userId: string,
  orgSlug: string,
  websiteId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug: orgSlug },
    },
    include: { organization: { select: { id: true } } },
  });

  if (!membership) return null;

  const website = await prisma.website.findFirst({
    where: { id: websiteId, organizationId: membership.organization.id },
  });

  if (!website) return null;

  return { website, role: membership.role };
}

// POST /api/organizations/[slug]/websites/[websiteId]/analyze - Trigger analysis
export const POST = withUserAuth(
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

    // Don't trigger if already analyzing
    if (website.status === "analyzing") {
      return NextResponse.json(
        { success: false, error: "Analysis already in progress" },
        { status: 409 }
      );
    }

    try {
      // Run analysis in the background (don't wait for it)
      // In production with serverless, this would be better handled by a queue
      // But for now, we'll run it directly
      analysis.runInitialAnalysis(websiteId).catch((error) => {
        console.error(`[API] Analysis failed for ${websiteId}:`, error);
      });

      return NextResponse.json({
        success: true,
        message: "Analysis started",
      });
    } catch (error) {
      console.error("[API] Error starting analysis:", error);
      return NextResponse.json(
        { success: false, error: "Failed to start analysis" },
        { status: 500 }
      );
    }
  }
);
