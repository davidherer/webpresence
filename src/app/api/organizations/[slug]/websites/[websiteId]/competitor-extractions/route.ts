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

    try {
      const body = await req.json();
      const { extractionIds } = body;

      if (!Array.isArray(extractionIds) || extractionIds.length === 0) {
        return NextResponse.json(
          { error: "Aucune extraction sélectionnée" },
          { status: 400 }
        );
      }

      // Supprimer les extractions
      const deleted = await prisma.competitorPageExtraction.deleteMany({
        where: {
          id: {
            in: extractionIds,
          },
          searchQuery: {
            websiteId,
          },
        },
      });

      return NextResponse.json({
        message: `${deleted.count} extraction${
          deleted.count > 1 ? "s" : ""
        } supprimée${deleted.count > 1 ? "s" : ""}`,
        count: deleted.count,
      });
    } catch (error) {
      console.error("Error deleting extractions:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression des extractions" },
        { status: 500 }
      );
    }
  }
);
