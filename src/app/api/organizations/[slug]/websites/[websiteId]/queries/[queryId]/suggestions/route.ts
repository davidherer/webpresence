import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { mistral } from "@/lib/mistral";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; queryId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check search query access
async function checkSearchQueryAccess(
  userId: string,
  slug: string,
  websiteId: string,
  queryId: string
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

  const searchQuery = await prisma.searchQuery.findFirst({
    where: {
      id: queryId,
      websiteId,
      website: { organizationId: membership.organizationId },
    },
    include: {
      website: {
        include: {
          pageAnalyses: { take: 5, orderBy: { createdAt: "desc" } },
          competitors: {
            include: {
              pageAnalyses: { take: 3, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      serpResults: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });

  return searchQuery;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/queries/:queryId/suggestions
 * Get AI suggestions for a search query
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const searchQuery = await checkSearchQueryAccess(
    user.id,
    slug,
    websiteId,
    queryId
  );
  if (!searchQuery) {
    return NextResponse.json(
      { success: false, error: "Search query not found" },
      { status: 404 }
    );
  }

  // Get query params for filtering
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending, accepted, dismissed
  const type = url.searchParams.get("type"); // content, keyword, technical, backlink

  const suggestions = await prisma.aISuggestion.findMany({
    where: {
      searchQueryId: queryId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  // Group by type
  const groupedByType = {
    content: suggestions.filter((s) => s.type === "content"),
    keyword: suggestions.filter((s) => s.type === "keyword"),
    technical: suggestions.filter((s) => s.type === "technical"),
    backlink: suggestions.filter((s) => s.type === "backlink"),
  };

  return NextResponse.json({
    success: true,
    data: {
      suggestions,
      groupedByType,
      stats: {
        total: suggestions.length,
        pending: suggestions.filter((s) => s.status === "pending").length,
        accepted: suggestions.filter((s) => s.status === "accepted").length,
        dismissed: suggestions.filter((s) => s.status === "dismissed").length,
        byPriority: {
          high: suggestions.filter((s) => s.priority >= 8).length,
          medium: suggestions.filter((s) => s.priority >= 5 && s.priority < 8)
            .length,
          low: suggestions.filter((s) => s.priority < 5).length,
        },
      },
    },
  });
});

/**
 * POST /api/organizations/:slug/websites/:websiteId/queries/:queryId/suggestions
 * Generate new AI suggestions for a search query
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, queryId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const searchQuery = await checkSearchQueryAccess(
    user.id,
    slug,
    websiteId,
    queryId
  );
  if (!searchQuery) {
    return NextResponse.json(
      { success: false, error: "Search query not found" },
      { status: 404 }
    );
  }

  // Get our page content
  const pageContents = searchQuery.website.pageAnalyses.map((p) => ({
    url: p.url,
    title: p.title,
    metaDescription: p.metaDescription,
    headings: p.headings as { h1: string[]; h2: string[]; h3: string[] },
    keywords: (
      p.keywords as Array<{ keyword: string; frequency: number }>
    ).slice(0, 10),
  }));

  // Get competitor pages for comparison
  const competitorPages = searchQuery.website.competitors.flatMap((c) =>
    c.pageAnalyses.map((p) => ({
      url: p.url,
      title: p.title || "",
      metaDescription: p.metaDescription || "",
      headings: p.headings as { h1: string[]; h2: string[]; h3: string[] },
      keywords:
        (p.keywords as Array<{ keyword: string; frequency: number }>) || [],
    }))
  );

  // Get SERP performance
  const serpPerformance = searchQuery.serpResults
    .filter((r) => r.position !== null)
    .map((r) => ({
      position: r.position!,
      url: searchQuery.website.url,
      title: r.title || searchQuery.title,
      snippet: r.snippet || "",
    }));

  // Build current page content (use first analysis or create from search query)
  const currentPage = pageContents[0] || {
    url: searchQuery.website.url,
    title: searchQuery.title,
    metaDescription: searchQuery.description || "",
    headings: { h1: [searchQuery.title], h2: [], h3: [] },
    keywords: [{ keyword: searchQuery.query, frequency: 1 }],
  };

  // Generate suggestions using AI
  const aiSuggestions = await mistral.generateSEOSuggestions(
    searchQuery.title,
    searchQuery.query, // Single query string
    currentPage,
    serpPerformance,
    competitorPages
  );

  // Save suggestions to database
  const createdSuggestions = [];
  for (const suggestion of aiSuggestions) {
    const created = await prisma.aISuggestion.create({
      data: {
        searchQueryId: queryId,
        type: suggestion.type,
        title: suggestion.title,
        content: suggestion.content,
        priority: suggestion.priority,
        status: "pending",
      },
    });
    createdSuggestions.push(created);
  }

  return NextResponse.json({
    success: true,
    data: {
      generated: createdSuggestions.length,
      suggestions: createdSuggestions,
    },
  });
});
