import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";

// GET /api/websites/[websiteId]/extractions
// Liste paginée des extractions de pages avec filtres
export async function GET(
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

    // Paramètres de requête
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || ""; // quick, full, null
    const status = searchParams.get("status") || ""; // pending, extracting, completed, failed

    // Construire les filtres
    interface WhereClause {
      websiteId: string;
      type?: string | null;
      status?: string;
      OR?: Array<{
        url?: { contains: string; mode: "insensitive" };
        title?: { contains: string; mode: "insensitive" };
        metaDescription?: { contains: string; mode: "insensitive" };
        h1?: { has: string };
      }>;
    }
    const where: WhereClause = {
      websiteId,
    };

    // Filtre par type
    if (type) {
      if (type === "null") {
        where.type = null;
      } else {
        where.type = type;
      }
    }

    // Filtre par status
    if (status) {
      where.status = status;
    }

    // Filtre par recherche (dans url, title, metaDescription, h1)
    if (search) {
      where.OR = [
        { url: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { metaDescription: { contains: search, mode: "insensitive" } },
        { h1: { has: search } },
      ];
    }

    // Compter le total
    const totalCount = await prisma.pageExtraction.count({ where });

    // Récupérer les extractions
    const extractions = await prisma.pageExtraction.findMany({
      where,
      orderBy: [{ extractedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        url: true,
        source: true,
        type: true,
        status: true,
        title: true,
        metaDescription: true,
        h1: true,
        createdAt: true,
        extractedAt: true,
        error: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        extractions,
        totalCount,
        page,
        limit,
        hasMore: page * limit < totalCount,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching extractions:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/websites/[websiteId]/extractions
// Lancer une ou plusieurs extractions
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
    const { urls, type, source = "manual" } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: "URLs array is required" },
        { status: 400 }
      );
    }

    if (!type || (type !== "quick" && type !== "full")) {
      return NextResponse.json(
        { success: false, error: 'Type must be "quick" or "full"' },
        { status: 400 }
      );
    }

    console.log(
      `[API] Creating ${urls.length} extraction(s) for website ${websiteId}`
    );

    // Pour chaque URL, créer ou mettre à jour l'extraction
    const results = [];
    const jobsToCreate = [];

    for (const url of urls) {
      // Vérifier si une extraction existe déjà pour cette URL
      const existing = await prisma.pageExtraction.findFirst({
        where: {
          websiteId,
          url,
        },
        orderBy: { createdAt: "desc" },
      });

      // Déterminer si on doit créer une nouvelle extraction
      let shouldExtract = false;
      let extraction;

      if (!existing) {
        // Pas d'extraction existante, créer
        shouldExtract = true;
        extraction = await prisma.pageExtraction.create({
          data: {
            websiteId,
            url,
            source,
            type: null, // Sera mis à jour après l'extraction
            status: "pending",
          },
        });
      } else {
        // Extraction existante, vérifier si on doit refaire
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (
          existing.status === "failed" ||
          !existing.extractedAt ||
          existing.extractedAt < oneDayAgo ||
          existing.type !== type
        ) {
          // Re-extraire si échec, trop vieux (>1 jour), ou type différent
          shouldExtract = true;
          extraction = await prisma.pageExtraction.update({
            where: { id: existing.id },
            data: {
              type: null,
              status: "pending",
              error: null,
            },
          });
        } else {
          // Extraction récente et réussie, on garde
          extraction = existing;
        }
      }

      results.push({
        url,
        extractionId: extraction.id,
        shouldExtract,
      });

      // Créer le job si nécessaire
      if (shouldExtract) {
        jobsToCreate.push({
          websiteId,
          type: "page_extraction" as const,
          status: "pending" as const,
          priority: 5,
          payload: {
            extractionId: extraction.id,
            url,
            extractionType: type,
          },
        });
      }
    }

    // Créer tous les jobs en une seule fois
    if (jobsToCreate.length > 0) {
      await prisma.analysisJob.createMany({
        data: jobsToCreate,
      });
      console.log(`[API] Created ${jobsToCreate.length} extraction job(s)`);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `${results.length} extraction(s) initiated`,
        results,
        jobsCreated: jobsToCreate.length,
      },
    });
  } catch (error) {
    console.error("[API] Error creating extractions:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
