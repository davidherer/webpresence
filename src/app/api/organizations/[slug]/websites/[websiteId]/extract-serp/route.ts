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
      select: { url: true },
    });

    let clientDomain: string | null = null;

    if (website?.url) {
      try {
        clientDomain = new URL(
          website.url.startsWith("http")
            ? website.url
            : `https://${website.url}`
        ).hostname;
      } catch (error) {
        console.error("Invalid website URL:", website.url);
      }
    }

    try {
      const body = await req.json();
      const { queryIds } = body;

      if (!Array.isArray(queryIds) || queryIds.length === 0) {
        return NextResponse.json(
          { error: "Aucune requête sélectionnée" },
          { status: 400 }
        );
      }

      // Récupérer les résultats SERP pour les requêtes sélectionnées (avec les données brutes)
      const serpResults = await prisma.serpResult.findMany({
        where: {
          searchQueryId: {
            in: queryIds,
          },
          searchQuery: {
            websiteId,
          },
          rawDataBlobUrl: {
            not: null,
          },
        },
        select: {
          id: true,
          searchQueryId: true,
          rawDataBlobUrl: true,
        },
        orderBy: { createdAt: "desc" },
        take: queryIds.length, // Un résultat SERP par requête (le plus récent)
      });

      console.log("SERP Results found:", serpResults.length);

      if (serpResults.length === 0) {
        return NextResponse.json(
          { error: "Aucun résultat SERP trouvé pour ces requêtes" },
          { status: 404 }
        );
      }

      // Extraire toutes les URLs des résultats SERP (top 10)
      const extractionsToCreate: Array<{
        searchQueryId: string;
        url: string;
        position: number;
        status: "pending";
        type: "quick";
        title: string | null;
      }> = [];

      for (const serpResult of serpResults) {
        if (!serpResult.rawDataBlobUrl) continue;

        try {
          // Récupérer les données brutes du SERP depuis le blob
          const blobResponse = await fetch(serpResult.rawDataBlobUrl);
          const serpData = await blobResponse.json();

          console.log("SERP Data keys:", Object.keys(serpData));
          
          // Extraire les résultats organiques
          const organicResults =
            serpData.results || serpData.organic || serpData.organic_results || [];

          console.log("Organic results found:", organicResults.length);
          if (organicResults.length > 0) {
            console.log("First organic result:", organicResults[0]);
          }

          for (const result of organicResults.slice(0, 10)) {
            const url = result.link || result.url;
            const position = result.position;
            const title = result.title;

            console.log(`Processing result - URL: ${url}, Position: ${position}`);

            if (!url || !position) continue;

            // Exclure le domaine client si défini
            if (clientDomain) {
              try {
                const resultDomain = new URL(url).hostname;
                console.log(`Comparing domains - Result: ${resultDomain}, Client: ${clientDomain}`);
                if (resultDomain === clientDomain) {
                  console.log("Skipping client domain");
                  continue;
                }
              } catch {
                console.log("Invalid URL, skipping");
                continue;
              }
            }

            extractionsToCreate.push({
              searchQueryId: serpResult.searchQueryId,
              url,
              position,
              status: "pending",
              type: "quick",
              title,
            });
          }
        } catch (error) {
          console.error(
            `Failed to process SERP data for ${serpResult.id}:`,
            error
          );
        }
      }

      console.log("Extractions to create:", extractionsToCreate.length);

      if (extractionsToCreate.length === 0) {
        return NextResponse.json(
          {
            error: "Aucune page concurrente trouvée dans les résultats SERP",
          },
          { status: 404 }
        );
      }

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
      const createdExtractions = [];
      for (const extraction of newExtractions) {
        const created = await prisma.competitorPageExtraction.create({
          data: extraction,
        });
        createdExtractions.push(created);
      }

      // Créer les jobs d'extraction
      const jobs = createdExtractions.map((extraction) => ({
        websiteId,
        type: "competitor_page_extraction" as const,
        status: "pending" as const,
        priority: 5,
        payload: {
          extractionId: extraction.id,
          url: extraction.url,
          extractionType: extraction.type,
        },
      }));

      if (jobs.length > 0) {
        await prisma.analysisJob.createMany({
          data: jobs,
        });
      }

      return NextResponse.json({
        message: `${createdExtractions.length} extraction${
          createdExtractions.length > 1 ? "s" : ""
        } créée${createdExtractions.length > 1 ? "s" : ""}`,
        count: createdExtractions.length,
        skipped: extractionsToCreate.length - newExtractions.length,
        jobsCreated: jobs.length,
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
