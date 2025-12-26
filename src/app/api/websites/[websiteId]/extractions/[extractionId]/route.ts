import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";

// GET /api/websites/[websiteId]/extractions/[extractionId]
// Récupérer les détails d'une extraction
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ websiteId: string; extractionId: string }> }
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

    const { websiteId, extractionId } = await params;

    // Récupérer l'extraction avec vérification d'accès
    const extraction = await prisma.pageExtraction.findFirst({
      where: {
        id: extractionId,
        websiteId,
        website: {
          organization: {
            members: {
              some: {
                userId: user.id,
              },
            },
          },
        },
      },
    });

    if (!extraction) {
      return NextResponse.json(
        { success: false, error: "Extraction not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: extraction,
    });
  } catch (error) {
    console.error("[API] Error fetching extraction:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
