import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import CompetitorsListClient from "./_components/CompetitorsListClient";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

/**
 * Compute competitor score based on SERP comparisons.
 * Uses SerpResult data directly from the database (not from blob storage).
 */
async function computeCompetitorScore(
  competitorId: string,
  websiteId: string
): Promise<{ better: number; worse: number; total: number }> {
  // Get our latest SERP positions (from search queries)
  const ourResults = await prisma.serpResult.findMany({
    where: {
      searchQuery: { websiteId, isActive: true },
      searchQueryId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true },
  });

  // Build a map of our latest position per query
  const ourPositions = new Map<string, number | null>();
  for (const result of ourResults) {
    const queryLower = result.query.toLowerCase();
    if (!ourPositions.has(queryLower)) {
      ourPositions.set(queryLower, result.position);
    }
  }

  // Get competitor's latest SERP positions
  const competitorResults = await prisma.serpResult.findMany({
    where: { competitorId },
    orderBy: { createdAt: "desc" },
    select: { query: true, position: true },
  });

  // Build a map of competitor's latest position per query
  const theirPositions = new Map<string, number | null>();
  for (const result of competitorResults) {
    const queryLower = result.query.toLowerCase();
    if (!theirPositions.has(queryLower)) {
      theirPositions.set(queryLower, result.position);
    }
  }

  // Compare positions on common queries
  let better = 0;
  let worse = 0;
  let total = 0;

  // Get all unique queries from both sets
  const allQueries = new Set([...ourPositions.keys(), ...theirPositions.keys()]);

  for (const query of allQueries) {
    const ourPos = ourPositions.get(query);
    const theirPos = theirPositions.get(query);

    const weArePresent = ourPos !== null && ourPos !== undefined && ourPos > 0;
    const theyArePresent = theirPos !== null && theirPos !== undefined && theirPos > 0;

    // Only count if at least one is present
    if (weArePresent || theyArePresent) {
      total++;

      if (weArePresent && !theyArePresent) {
        better++;
      } else if (!weArePresent && theyArePresent) {
        worse++;
      } else if (weArePresent && theyArePresent) {
        if (ourPos! < theirPos!) {
          better++;
        } else if (ourPos! > theirPos!) {
          worse++;
        }
        // Equal positions don't count as better or worse
      }
    }
  }

  return { better, worse, total };
}

export default async function CompetitorsListPage({ params }: PageProps) {
  const { slug, websiteId } = await params;
  const user = await getUserSession();
  if (!user) redirect("/");

  // Check access
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      organization: { slug },
    },
    include: { organization: true },
  });

  if (!membership) notFound();

  // Fetch website with competitors
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organization.id,
    },
    include: {
      competitors: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!website) notFound();

  // Compute scores for each competitor
  const competitorsWithScores = await Promise.all(
    website.competitors.map(async (competitor) => {
      const score = await computeCompetitorScore(competitor.id, websiteId);
      return { ...competitor, score };
    })
  );

  return (
    <CompetitorsListClient
      orgSlug={slug}
      websiteId={websiteId}
      competitors={competitorsWithScores}
    />
  );
}
