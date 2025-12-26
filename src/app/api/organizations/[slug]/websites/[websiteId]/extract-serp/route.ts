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

    // Récupérer le domaine du site web client pour l'exclure
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { domain: true },
    });

    if (!website?.domain) {
      return NextResponse.json(
        { error: "Domaine du site web non trouvé" },
        { status: 404 }
      );
    }

    const clientDomain = new URL(
      website.domain.startsWith("http")
        ? website.domain
        : `https://${website.domain}`
    ).hostname;

    try {
      const body = await req.json();
      const { queryIds } = body;

      if (!Array.isArray(queryIds) || queryIds.length === 0) {
        return NextResponse.json(
          { error: "Aucune requête sélectionnée" },
          { status: 400 }
        );
      }

      // Récupérer les résultats SERP pour les requêtes sélectionnées (top 10 uniquement)
      const serpResults = await prisma.serpResult.findMany({
        where: {
          searchQueryId: {
            in: queryIds,
          },
          searchQuery: {
            websiteId,
          },
          url: {
            not: null,
          },
          position: {
            not: null,
            lte: 10,
          },
        },
        select: {
          id: true,
          url: true,
          position: true,
          searchQueryId: true,
          title: true,
        },
        orderBy: [{ searchQueryId: "asc" }, { position: "asc" }],
      });

      if (serpResults.length === 0) {
        return NextResponse.json(
          { error: "Aucun résultat SERP trouvé pour ces requêtes" },
          { status: 404 }
        );
      }

      // Filtrer pour ne garder que les URLs concurrentes (exclure le domaine client)
      const competitorResults = serpResults.filter((result) => {
        if (!result.url) return false;
        try {
          const resultDomain = new URL(result.url).hostname;
          return resultDomain !== clientDomain;
        } catch {
          return false;
        }
      });

      if (competitorResults.length === 0) {
        return NextResponse.json(
          { error: "Aucune page concurrente trouvée dans les résultats SERP" },
          { status: 404 }
        );
      }

      // Créer les extractions concurrentes
      const extractionsToCreate = competitorResults
        .filter((result) => result.url && result.position)
        .map((result) => {
          return {
            searchQueryId: result.searchQueryId,
            url: result.url!,
            position: result.position,
            status: "pending" as const,
            type: "quick" as const,
            title: result.title,
          };
        });

      // Vérifier les extractions existantes pour éviter les doublons
      const existingExtractions =
        await prisma.competitorPageExtraction.findMany({
          where: {
            searchQueryId: {
              in: queryIds,
            },
            url: {
              in: extractionsToCreate.map((e) => e.url),
            },
          },
          select: {
            searchQueryId: true,
            url: true,
          },
        });

      const existingSet = new Set(
        existingExtractions.map((e) => `${e.searchQueryId}-${e.url}`)
      );

      const newExtractions = extractionsToCreate.filter(
        (e) => !existingSet.has(`${e.searchQueryId}-${e.url}`)
      );

      if (newExtractions.length === 0) {
        return NextResponse.json({
          message: "Toutes les extractions existent déjà",
          count: 0,
          skipped: extractionsToCreate.length,
        });
      }

      // Créer les nouvelles extractions
      const created = await prisma.competitorPageExtraction.createMany({
        data: newExtractions,
        skipDuplicates: true,
      });

      return NextResponse.json({
        message: `${created.count} extraction${
          created.count > 1 ? "s" : ""
        } créée${created.count > 1 ? "s" : ""}`,
        count: created.count,
        skipped: extractionsToCreate.length - newExtractions.length,
      });
    } catch (error) {
      console.error("Error creating extractions:", error);
      return NextResponse.json(
        { error: "Erreur lors de la création des extractions" },
        { status: 500 }
      );
    }
  }
);
