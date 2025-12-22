import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";

type RouteContext = { params: Promise<{ slug: string; websiteId: string }> };

const generateQueriesSchema = z.object({
  projectIdea: z.string().min(10).max(2000),
  targetAudience: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
});

// Helper to check access
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

interface GeneratedQuery {
  query: string;
  description: string;
  tags: string[];
  competitionLevel: "HIGH" | "LOW";
  confidence: number;
}

interface AIResponse {
  searchQueries: GeneratedQuery[];
  summary: string;
  recommendations: string[];
}

// POST /api/organizations/[slug]/websites/[websiteId]/generate-queries
// Generate search queries from a project idea
export const POST = withUserAuth(
  async (req: NextRequest, context: RouteContext) => {
    const user = (req as typeof req & { user: { id: string } }).user;
    const { slug, websiteId } = await context.params;

    const access = await checkWebsiteAccess(user.id, slug, websiteId);
    if (!access) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validation = generateQueriesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { projectIdea, targetAudience, location } = validation.data;

    try {
      // Call Mistral to generate search queries
      const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });

      const prompt = `Tu es un expert en marketing digital et SEO. On te donne une idée de projet/business et tu dois identifier les requêtes de recherche que les clients potentiels utiliseraient pour trouver ce type de produit/service.

PROJET/IDÉE:
${projectIdea}

${targetAudience ? `AUDIENCE CIBLE: ${targetAudience}` : ""}
${location ? `LOCALISATION: ${location}` : ""}

INSTRUCTIONS:
1. Génère 8 à 15 requêtes de recherche pertinentes que des clients potentiels utiliseraient
2. Inclus un mix de:
   - Requêtes génériques à forte concurrence (2-3 mots)
   - Requêtes de longue traîne moins compétitives (4-6 mots)
   - Requêtes incluant la localisation si pertinent
   - Requêtes basées sur l'intention (acheter, trouver, meilleur, etc.)

3. Pour chaque requête, fournis:
   - La requête exacte (1-6 mots-clés, en français si le projet est francophone)
   - Une description de l'intention de recherche
   - Des tags pour catégoriser (type de produit, service, audience, etc.)
   - Le niveau de concurrence: UNIQUEMENT "HIGH" ou "LOW" (pas d'autre valeur)
   - Un score de confiance (0.5-1.0)

4. Donne un résumé de la stratégie SEO recommandée
5. Liste 3-5 recommandations pour ce projet

IMPORTANT: competitionLevel doit être EXACTEMENT "HIGH" ou "LOW", aucune autre valeur n'est acceptée.

RÉPONDS UNIQUEMENT EN JSON:
{
  "searchQueries": [
    {
      "query": "mots clés recherche",
      "description": "Description de l'intention et de l'audience",
      "tags": ["catégorie", "type"],
      "competitionLevel": "HIGH",
      "confidence": 0.85
    }
  ],
  "summary": "Résumé de la stratégie SEO",
  "recommendations": ["Recommandation 1", "Recommandation 2"]
}`;

      console.log("[GenerateQueries] Calling Mistral AI...");
      const response = await client.chat.complete({
        model: "mistral-large-latest",
        messages: [{ role: "user", content: prompt }],
        responseFormat: { type: "json_object" },
        temperature: 0.4,
      });
      console.log("[GenerateQueries] ✓ AI response received");

      const content = response.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("Empty response from AI");
      }

      const aiResult: AIResponse = JSON.parse(content);

      // Create search queries in database
      const createdQueries = await prisma.$transaction(async (tx) => {
        const queries = [];

        for (const sq of aiResult.searchQueries) {
          // Check if query already exists
          const existing = await tx.searchQuery.findFirst({
            where: { websiteId, query: sq.query },
          });

          if (!existing) {
            // Normalize competitionLevel to only HIGH or LOW
            const normalizedCompetitionLevel: "HIGH" | "LOW" =
              sq.competitionLevel === "LOW" ? "LOW" : "HIGH";

            const created = await tx.searchQuery.create({
              data: {
                websiteId,
                query: sq.query,
                description: sq.description,
                tags: sq.tags,
                competitionLevel: normalizedCompetitionLevel,
                confidence: sq.confidence,
              },
            });
            queries.push(created);
          }
        }

        // Update website status to active if it was draft
        if (access.website.status === "draft") {
          await tx.website.update({
            where: { id: websiteId },
            data: { status: "active" },
          });
        }

        return queries;
      });

      // Create AI report with the analysis
      await prisma.aIReport.create({
        data: {
          websiteId,
          type: "idea_analysis",
          title: `Analyse d'idée de projet`,
          content: `## Résumé\n\n${
            aiResult.summary
          }\n\n## Requêtes générées\n\n${aiResult.searchQueries
            .map((q) => `- **${q.query}**: ${q.description}`)
            .join("\n")}\n\n## Recommandations\n\n${aiResult.recommendations
            .map((r) => `- ${r}`)
            .join("\n")}`,
          metadata: {
            projectIdea,
            targetAudience,
            location,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          queriesCreated: createdQueries.length,
          queries: createdQueries,
          summary: aiResult.summary,
          recommendations: aiResult.recommendations,
        },
      });
    } catch (error) {
      console.error("[GenerateQueries] Error:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate queries",
        },
        { status: 500 }
      );
    }
  }
);
