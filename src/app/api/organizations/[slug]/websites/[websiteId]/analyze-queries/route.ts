import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { serp } from "@/lib/analysis";

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

// POST /api/organizations/[slug]/websites/[websiteId]/analyze-queries - Trigger analysis for specific queries
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

    try {
      const body = await req.json();
      const { queryIds } = body;

      if (!Array.isArray(queryIds) || queryIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid query IDs" },
          { status: 400 }
        );
      }

      // Get the search queries
      const searchQueries = await prisma.searchQuery.findMany({
        where: {
          id: { in: queryIds },
          websiteId,
        },
      });

      if (searchQueries.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid queries found" },
          { status: 404 }
        );
      }

      // Run analysis for each query in the background
      for (const searchQuery of searchQueries) {
        serp
          .runSerpAnalysis(websiteId, searchQuery.id, [searchQuery.query])
          .catch((error: unknown) => {
            console.error(
              `[API] SERP analysis failed for query ${searchQuery.id}:`,
              error
            );
          });
      }

      return NextResponse.json({
        success: true,
        message: `Analysis started for ${searchQueries.length} quer${
          searchQueries.length > 1 ? "ies" : "y"
        }`,
        analyzedCount: searchQueries.length,
      });
    } catch (error) {
      console.error("[API] Error starting query analysis:", error);
      return NextResponse.json(
        { success: false, error: "Failed to start analysis" },
        { status: 500 }
      );
    }
  }
);
