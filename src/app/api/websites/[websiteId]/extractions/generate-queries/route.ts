import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "@/lib/auth/user";
import { prisma } from "@/lib/db";
import { mistralClient } from "@/lib/mistral";

interface GeneratedQuery {
  query: string;
  intent: string;
  competition: string;
  relevance: number;
}

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
    const { urls, intentType, competitionLevel, location } = await req.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "URLs manquantes ou invalides" },
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
      include: {
        organization: {
          select: { name: true },
        },
      },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website introuvable" },
        { status: 404 }
      );
    }

    // Récupérer les extractions correspondantes
    const extractions = await prisma.pageExtraction.findMany({
      where: {
        websiteId,
        url: { in: urls },
        status: "completed",
      },
      select: {
        id: true,
        url: true,
        title: true,
        metaDescription: true,
        h1: true,
        headings: true,
        keywords: true,
      },
    });

    if (extractions.length === 0) {
      return NextResponse.json(
        { error: "Aucune extraction complétée trouvée pour les URLs fournies" },
        { status: 404 }
      );
    }

    // Préparer le contexte pour Mistral
    const context = extractions
      .map((ext) => {
        const headingsData = ext.headings as Record<string, string[]> | null;
        const keywordsData = ext.keywords as Array<{
          keyword: string;
          frequency: number;
        }> | null;

        return `
URL: ${ext.url}
Titre: ${ext.title || "N/A"}
Meta Description: ${ext.metaDescription || "N/A"}
H1: ${ext.h1?.join(", ") || "N/A"}
Headings: ${headingsData ? JSON.stringify(headingsData).slice(0, 200) : "N/A"}
Mots-clés: ${keywordsData ? JSON.stringify(keywordsData).slice(0, 200) : "N/A"}
`;
      })
      .join("\n---\n");

    // Construire le prompt selon les filtres
    let intentInstruction = "";
    switch (intentType) {
      case "informational":
        intentInstruction =
          "Concentrez-vous sur les requêtes informationnelles (recherche d'information, guides, tutoriels, définitions).";
        break;
      case "commercial":
        intentInstruction =
          "Concentrez-vous sur les requêtes commerciales (comparaisons, avis, meilleurs produits, alternatives).";
        break;
      case "navigational":
        intentInstruction =
          "Concentrez-vous sur les requêtes navigationnelles (recherche d'un site ou d'une marque spécifique).";
        break;
      case "transactional":
        intentInstruction =
          "Concentrez-vous sur les requêtes transactionnelles (acheter, télécharger, s'inscrire, commander).";
        break;
      default:
        intentInstruction = "Incluez tous les types d'intentions de recherche.";
    }

    let competitionInstruction = "";
    switch (competitionLevel) {
      case "low":
        competitionInstruction =
          "IMPORTANT: Génère UNIQUEMENT des requêtes de longue traîne (4 mots ou plus) avec faible concurrence. 100% des requêtes doivent être spécifiques et cibler des niches. Exemples: 'acheter planche surf débutant pas cher', 'meilleur restaurant végétarien paris 11ème'. Le niveau de concurrence doit être 'low' pour TOUTES les requêtes.";
        break;
      case "medium":
        competitionInstruction =
          "IMPORTANT: Génère un mix équilibré: 70% de requêtes moyennes (3-4 mots) avec concurrence modérée, et 30% de requêtes longue traîne. Exemples moyens: 'cours yoga en ligne', 'livraison pizza rapide'. Évite les requêtes trop génériques.";
        break;
      case "high":
        competitionInstruction =
          "IMPORTANT: Génère des requêtes génériques et à fort volume: 70% de requêtes courtes (1-3 mots) avec haute concurrence, 30% de requêtes moyennes. Exemples: 'plombier', 'assurance auto', 'restaurant paris'. Ces requêtes ciblent un large public.";
        break;
      default:
        competitionInstruction =
          "Génère un mix équilibré: 40% de requêtes longue traîne (low), 40% de requêtes moyennes (medium), 20% de requêtes génériques (high).";
    }

    const locationInstruction = location
      ? `\nLOCALISATION: ${location}\nIMPORTANT: Intègre cette localisation dans les requêtes UNIQUEMENT quand c'est pertinent (services locaux, commerces, professionnels). N'ajoute PAS la localisation pour des produits en ligne ou services dématérialisés.\n`
      : "";

    const prompt = `Tu es un expert SEO. Analyse le contenu extrait des pages suivantes et génère une liste de requêtes de recherche pertinentes que les utilisateurs pourraient utiliser pour trouver ces pages.

${intentInstruction}

${competitionInstruction}

${locationInstruction}
Contenu des pages:
${context}

Génère une liste de 10 à 20 requêtes de recherche pertinentes en français.
Pour chaque requête, fournis:
- La requête elle-même (RESPECTE STRICTEMENT le nombre de mots selon le niveau de concurrence)
- Le type d'intention (informational, commercial, navigational, transactional)
- Le niveau de concurrence estimé (low, medium, high) - DOIT correspondre à la longueur de la requête
- Un score de pertinence (1-10)

RÈGLES STRICTES pour le niveau de concurrence:
- low = 4 mots ou plus (longue traîne, niches)
- medium = 3-4 mots (concurrence modérée)
- high = 1-3 mots (générique, forte concurrence)

Réponds UNIQUEMENT avec un tableau JSON valide au format suivant:
[
  {
    "query": "exemple de requête",
    "intent": "informational",
    "competition": "low",
    "relevance": 8
  }
]`;

    // Appeler Mistral AI
    const chatResponse = await mistralClient.chat.complete({
      model: "mistral-large-latest",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    const content = chatResponse.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Réponse invalide de l'IA" },
        { status: 500 }
      );
    }

    // Parser la réponse JSON
    let queries: GeneratedQuery[] = [];
    try {
      // Extraire le JSON de la réponse (en cas de texte additionnel)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        queries = JSON.parse(jsonMatch[0]);
      } else {
        queries = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse Mistral response:", parseError);
      return NextResponse.json(
        { error: "Erreur lors du parsing de la réponse IA", content },
        { status: 500 }
      );
    }

    // TODO: Stocker les requêtes générées dans la base de données
    // Pour l'instant, on retourne juste les résultats

    return NextResponse.json({
      success: true,
      queries,
      extractionsAnalyzed: extractions.length,
    });
  } catch (error) {
    console.error("Error generating queries:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération des requêtes" },
      { status: 500 }
    );
  }
}
