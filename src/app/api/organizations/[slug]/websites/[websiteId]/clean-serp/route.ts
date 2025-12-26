import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

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

// POST /api/organizations/[slug]/websites/[websiteId]/clean-serp - Clean SERP results for specific queries
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

      // Get the search queries to verify they belong to this website
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

      // Delete all SERP results for these queries
      const deleteResult = await prisma.serpResult.deleteMany({
        where: {
          searchQueryId: { in: searchQueries.map((q) => q.id) },
        },
      });

      console.log(
        `[API] Deleted ${deleteResult.count} SERP results for ${searchQueries.length} queries`
      );

      return NextResponse.json({
        success: true,
        message: `Nettoyage effectué pour ${searchQueries.length} requête${
          searchQueries.length > 1 ? "s" : ""
        }`,
        deletedCount: deleteResult.count,
        queryCount: searchQueries.length,
      });
    } catch (error) {
      console.error("[API] Error cleaning SERP results:", error);
      return NextResponse.json(
        { success: false, error: "Failed to clean SERP results" },
        { status: 500 }
      );
    }
  }
);
