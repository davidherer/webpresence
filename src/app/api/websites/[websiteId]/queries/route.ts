import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ websiteId: string }> }
) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { websiteId } = await params;
    const { queries } = await req.json();

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      return NextResponse.json(
        { error: "Requêtes manquantes ou invalides" },
        { status: 400 }
      );
    }

    // Vérifier que le website existe et appartient à une organisation de l'utilisateur
    const website = await prisma.website.findFirst({
      where: {
        id: websiteId,
        organization: {
          members: {
            some: { userId: session.id },
          },
        },
      },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website introuvable" },
        { status: 404 }
      );
    }

    // Créer les requêtes (éviter les doublons)
    const createdQueries = [];
    for (const queryData of queries) {
      // Vérifier si la requête existe déjà
      const existing = await prisma.searchQuery.findFirst({
        where: {
          websiteId,
          query: queryData.query,
        },
      });

      if (!existing) {
        // Mapper les niveaux de concurrence (Prisma n'accepte que HIGH ou LOW)
        let competitionLevel: "HIGH" | "LOW" = "HIGH";
        const level = queryData.competitionLevel?.toUpperCase();
        if (level === "LOW") {
          competitionLevel = "LOW";
        } else if (level === "MEDIUM" || level === "HIGH") {
          competitionLevel = "HIGH";
        }

        const created = await prisma.searchQuery.create({
          data: {
            websiteId,
            query: queryData.query,
            competitionLevel,
            confidence: queryData.confidence || 0.8,
            tags: queryData.tags || [],
            description: queryData.description || null,
          },
        });
        createdQueries.push(created);
      }
    }

    return NextResponse.json({
      success: true,
      created: createdQueries.length,
      skipped: queries.length - createdQueries.length,
    });
  } catch (error) {
    console.error("Error creating queries:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création des requêtes" },
      { status: 500 }
    );
  }
}
