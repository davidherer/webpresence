import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; competitorId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check website access
async function checkWebsiteAccess(
  userId: string,
  slug: string,
  websiteId: string
) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organization: { slug },
    },
  });

  if (!membership) {
    return null;
  }

  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organizationId,
    },
  });

  return website;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/competitors/:competitorId/score
 * Get the SERP comparison score for a competitor
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, competitorId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const website = await checkWebsiteAccess(user.id, slug, websiteId);
  if (!website) {
    return NextResponse.json(
      { success: false, error: "Website not found" },
      { status: 404 }
    );
  }

  const competitor = await prisma.competitor.findFirst({
    where: {
      id: competitorId,
      websiteId,
    },
  });

  if (!competitor) {
    return NextResponse.json(
      { success: false, error: "Competitor not found" },
      { status: 404 }
    );
  }

  const competitorDomain = new URL(competitor.url).hostname.replace(
    /^www\./,
    ""
  );

  // Get all products for this website with their latest SERP results
  const products = await prisma.product.findMany({
    where: { websiteId, isActive: true },
    select: {
      id: true,
      serpResults: {
        where: { position: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1, // Most recent per product
        select: { query: true, position: true, rawDataBlobUrl: true },
      },
    },
  });

  let better = 0; // Times we rank better than competitor
  let worse = 0; // Times competitor ranks better than us
  let total = 0; // Total comparisons

  // For each product, check the SERP blob for competitor position
  for (const product of products) {
    for (const serpResult of product.serpResults) {
      if (!serpResult.rawDataBlobUrl) continue;

      try {
        const response = await fetch(serpResult.rawDataBlobUrl);
        if (!response.ok) continue;

        const serpData = await response.json();
        if (!serpData.results || !Array.isArray(serpData.results)) continue;

        // Find competitor in results
        const competitorResult = serpData.results.find(
          (r: { domain: string }) => {
            const resultDomain = r.domain.replace(/^www\./, "");
            return (
              resultDomain === competitorDomain ||
              resultDomain.endsWith(`.${competitorDomain}`)
            );
          }
        );

        const ourPosition = serpResult.position;
        const theirPosition = competitorResult?.position ?? null;

        // Count comparison only if at least one of us is present
        const weArePresent = ourPosition !== null && ourPosition > 0;
        const theyArePresent = theirPosition !== null && theirPosition > 0;

        if (weArePresent || theyArePresent) {
          total++;

          if (weArePresent && !theyArePresent) {
            // We are present, they are not - we are better
            better++;
          } else if (!weArePresent && theyArePresent) {
            // They are present, we are not - they are better
            worse++;
          } else if (weArePresent && theyArePresent) {
            // Both present - compare positions
            if (ourPosition! < theirPosition!) {
              better++; // Lower position = better ranking
            } else if (ourPosition! > theirPosition!) {
              worse++;
            }
          }
        }
      } catch {
        // Skip invalid blobs
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { better, worse, total },
  });
});
