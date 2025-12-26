import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";

interface RouteContext {
  params: Promise<{ websiteId: string }>;
}

// GET - Liste toutes les extractions de pages concurrentes pour un website
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { websiteId } = await context.params;

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
    });

    if (!website) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    // Récupérer toutes les extractions avec leurs requêtes
    const extractions = await prisma.competitorPageExtraction.findMany({
      where: {
        searchQuery: {
          websiteId,
        },
      },
      include: {
        searchQuery: {
          select: {
            id: true,
            query: true,
          },
        },
        competitor: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: [{ extractedAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ extractions });
  } catch (error) {
    console.error("Erreur lors de la récupération des extractions:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
