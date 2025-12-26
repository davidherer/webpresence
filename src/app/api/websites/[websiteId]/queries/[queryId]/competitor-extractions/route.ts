import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { extractPageContent } from "@/lib/extraction";

interface RouteContext {
  params: Promise<{ websiteId: string; queryId: string }>;
}

// GET - Liste les extractions de pages concurrentes pour une requête
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { websiteId, queryId } = await context.params;

    // Vérifier l'accès
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organization: {
          members: {
            some: { userId: user.id },
          },
        },
      },
      include: {
        searchQueries: {
          where: { id: queryId },
        },
      },
    });

    if (!website || website.searchQueries.length === 0) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    // Récupérer toutes les extractions
    const extractions = await prisma.competitorPageExtraction.findMany({
      where: {
        searchQueryId: queryId,
      },
      include: {
        competitor: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ extractions });
  } catch (error) {
    console.error("Erreur lors de la récupération des extractions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST - Créer une extraction rapide ou complète
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { websiteId, queryId } = await context.params;
    const body = await req.json();
    const { urls, type = "quick" } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "URLs requises" }, { status: 400 });
    }

    // Vérifier l'accès
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organization: {
          members: {
            some: { userId: user.id },
          },
        },
      },
      include: {
        searchQueries: {
          where: { id: queryId },
        },
      },
    });

    if (!website || website.searchQueries.length === 0) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const created = [];
    const errors = [];

    for (const urlData of urls) {
      const url = typeof urlData === "string" ? urlData : urlData.url;
      const position = typeof urlData === "object" ? urlData.position : null;

      try {
        // Trouver le concurrent associé si l'URL correspond
        const competitors = await prisma.competitor.findMany({
          where: {
            websiteId,
            isActive: true,
          },
        });

        let competitorId = null;
        for (const competitor of competitors) {
          if (url.includes(competitor.url) || competitor.url.includes(url)) {
            competitorId = competitor.id;
            break;
          }
        }

        // Créer l'extraction
        const extraction = await prisma.competitorPageExtraction.create({
          data: {
            searchQueryId: queryId,
            competitorId,
            url,
            position,
            source: "serp",
            type: null,
            status: "pending",
          },
        });

        created.push(extraction.id);

        // Lancer l'extraction en arrière-plan (ne pas attendre)
        extractCompetitorPage(extraction.id, type).catch((err) => {
          console.error(`Erreur d'extraction pour ${url}:`, err);
        });
      } catch (error) {
        console.error(`Erreur pour ${url}:`, error);
        errors.push({ url, error: (error as Error).message });
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors,
    });
  } catch (error) {
    console.error("Erreur lors de la création des extractions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// Fonction pour extraire le contenu d'une page concurrente
async function extractCompetitorPage(
  extractionId: string,
  type: "quick" | "full"
) {
  try {
    const extraction = await prisma.competitorPageExtraction.findUnique({
      where: { id: extractionId },
    });

    if (!extraction) {
      throw new Error("Extraction non trouvée");
    }

    // Mettre à jour le statut
    await prisma.competitorPageExtraction.update({
      where: { id: extractionId },
      data: {
        status: "extracting",
        type,
      },
    });

    // Extraire le contenu
    const content = await extractPageContent(extraction.url, type === "full");

    // Calculer les mots-clés pondérés pour l'extraction complète
    let keywords = null;
    if (type === "full" && content.keywords) {
      keywords = calculateWeightedKeywords(
        content.keywords,
        content.title,
        content.metaDescription,
        content.headings
      );
    }

    // Mettre à jour avec les résultats
    await prisma.competitorPageExtraction.update({
      where: { id: extractionId },
      data: {
        status: "completed",
        title: content.title,
        metaDescription: content.metaDescription,
        h1: content.h1,
        headings: type === "full" ? content.headings : null,
        keywords,
        htmlBlobUrl: content.htmlBlobUrl,
        extractedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Erreur d'extraction:", error);
    await prisma.competitorPageExtraction.update({
      where: { id: extractionId },
      data: {
        status: "failed",
        error: (error as Error).message,
      },
    });
  }
}

// Fonction pour calculer les mots-clés pondérés
function calculateWeightedKeywords(
  keywords: Array<{ keyword: string; frequency: number; density?: number }>,
  title?: string | null,
  metaDescription?: string | null,
  headings?: {
    h2?: string[];
    h3?: string[];
    h4?: string[];
    h5?: string[];
    h6?: string[];
  }
): Array<{
  keyword: string;
  frequency: number;
  density: number;
  score: number;
}> {
  const titleLower = (title || "").toLowerCase();
  const descriptionLower = (metaDescription || "").toLowerCase();
  const allHeadings: string[] = [];

  if (headings) {
    for (const level of ["h2", "h3", "h4", "h5", "h6"] as const) {
      if (headings[level]) {
        allHeadings.push(
          ...headings[level]!.map((h: string) => h.toLowerCase())
        );
      }
    }
  }

  return keywords
    .map((kw) => {
      const kwLower = kw.keyword.toLowerCase();
      let score = kw.frequency;

      // Pondération par présence dans le titre (x5)
      if (titleLower.includes(kwLower)) {
        score *= 5;
      }

      // Pondération par présence dans la meta description (x3)
      if (descriptionLower.includes(kwLower)) {
        score *= 3;
      }

      // Pondération par présence dans les headings (x2)
      const headingCount = allHeadings.filter((h) =>
        h.includes(kwLower)
      ).length;
      if (headingCount > 0) {
        score *= 1 + headingCount * 0.5;
      }

      return {
        keyword: kw.keyword,
        frequency: kw.frequency,
        density: kw.density || 0,
        score: Math.round(score * 100) / 100,
      };
    })
    .sort((a, b) => b.score - a.score);
}
