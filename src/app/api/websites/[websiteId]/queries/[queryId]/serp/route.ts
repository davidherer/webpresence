import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";

interface RouteContext {
  params: Promise<{ websiteId: string; queryId: string }>;
}

// GET - Récupérer les résultats SERP pour une requête
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

    // Récupérer les résultats SERP les plus récents
    const results = await prisma.serpResult.findMany({
      where: {
        searchQueryId: queryId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Grouper par URL pour ne garder que les plus récents
    const latestResults = new Map();
    for (const result of results) {
      if (result.url && !latestResults.has(result.url)) {
        latestResults.set(result.url, result);
      }
    }

    return NextResponse.json({
      results: Array.from(latestResults.values()).sort(
        (a, b) => (a.position || 999) - (b.position || 999)
      ),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des résultats SERP:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
