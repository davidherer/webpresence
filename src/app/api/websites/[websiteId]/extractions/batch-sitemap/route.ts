import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";

// POST /api/websites/[websiteId]/extractions/batch-sitemap
// Créer des extractions pour toutes les URLs du dernier sitemap snapshot
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    // Vérifier l'authentification
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { websiteId } = await params;

    // Vérifier que l'utilisateur a accès au website
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organization: {
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      },
    });

    if (!website) {
      return NextResponse.json(
        { success: false, error: "Website not found or access denied" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { type } = body;

    if (!type || (type !== "quick" && type !== "full")) {
      return NextResponse.json(
        { success: false, error: 'Type must be "quick" or "full"' },
        { status: 400 }
      );
    }

    console.log(
      `[API] Creating batch extractions from sitemap for website ${websiteId}`
    );

    // Récupérer le dernier snapshot de sitemap
    const latestSnapshot = await prisma.sitemapSnapshot.findFirst({
      where: { websiteId },
      orderBy: { fetchedAt: "desc" },
    });

    if (!latestSnapshot) {
      return NextResponse.json(
        { success: false, error: "No sitemap snapshot found" },
        { status: 404 }
      );
    }

    // Récupérer toutes les URLs du sitemap depuis le blob
    const { storage } = await import("@/lib/storage");
    let sitemapData;
    try {
      sitemapData = await storage.getSitemapData(latestSnapshot.blobUrl);
    } catch (err) {
      console.error("Failed to fetch sitemap data from blob:", err);
      return NextResponse.json(
        { success: false, error: "Failed to load sitemap data" },
        { status: 500 }
      );
    }

    const urls = sitemapData.urls.map((u: { url: string }) => u.url);

    if (urls.length === 0) {
      return NextResponse.json(
        { success: false, error: "No URLs found in sitemap" },
        { status: 400 }
      );
    }

    console.log(`[API] Found ${urls.length} URLs in sitemap`);

    // Créer ou mettre à jour les extractions par batch
    const jobsToCreate = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Traiter par batch de 100 pour éviter les timeouts
    const BATCH_SIZE = 100;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batchUrls = urls.slice(i, i + BATCH_SIZE);

      // Récupérer les extractions existantes pour ce batch
      const existingExtractions = await prisma.pageExtraction.findMany({
        where: {
          websiteId,
          url: { in: batchUrls },
        },
      });

      const existingUrlsMap = new Map<string, any>(
        existingExtractions.map((e) => [e.url, e])
      );

      for (const url of batchUrls) {
        const existing = existingUrlsMap.get(url);

        // Déterminer si on doit créer une extraction
        let shouldExtract = false;
        let extractionId;

        if (!existing) {
          // Créer une nouvelle extraction
          const newExtraction = await prisma.pageExtraction.create({
            data: {
              websiteId,
              url,
              source: "sitemap",
              type: null,
              status: "pending",
            },
          });
          extractionId = newExtraction.id;
          shouldExtract = true;
          created++;
        } else {
          // Vérifier si on doit refaire l'extraction
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          if (
            existing.status === "failed" ||
            !existing.extractedAt ||
            existing.extractedAt < oneDayAgo ||
            existing.type !== type
          ) {
            // Mettre à jour pour re-extraire
            await prisma.pageExtraction.update({
              where: { id: existing.id },
              data: {
                type: null,
                status: "pending",
                error: null,
              },
            });
            extractionId = existing.id;
            shouldExtract = true;
            updated++;
          } else {
            // Extraction récente, on skip
            skipped++;
            continue;
          }
        }

        // Créer le job si nécessaire
        if (shouldExtract && extractionId) {
          jobsToCreate.push({
            websiteId,
            type: "page_extraction" as const,
            status: "pending" as const,
            priority: 3, // Priorité plus basse pour les extractions en masse
            payload: {
              extractionId,
              url,
              extractionType: type,
            },
          });
        }
      }
    }

    // Créer tous les jobs en une seule fois
    if (jobsToCreate.length > 0) {
      await prisma.analysisJob.createMany({
        data: jobsToCreate,
      });
      console.log(`[API] Created ${jobsToCreate.length} extraction jobs`);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `${urls.length} URLs traité(e)s`,
        created,
        updated,
        skipped,
        jobsCreated: jobsToCreate.length,
      },
    });
  } catch (error) {
    console.error("[API] Error creating batch extractions:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
