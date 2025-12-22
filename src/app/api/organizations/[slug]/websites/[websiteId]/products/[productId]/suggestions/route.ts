import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withUserAuth } from "@/lib/api/middleware";
import { mistral } from "@/lib/mistral";

interface RouteContext {
  params: Promise<{ slug: string; websiteId: string; productId: string }>;
}

interface AuthRequest extends Request {
  user: { id: string; email: string };
}

// Helper to check product access
async function checkProductAccess(
  userId: string,
  slug: string,
  websiteId: string,
  productId: string
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

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
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

  return product;
}

/**
 * GET /api/organizations/:slug/websites/:websiteId/products/:productId/suggestions
 * Get AI suggestions for a product
 */
export const GET = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  // Get query params for filtering
  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // pending, accepted, dismissed
  const type = url.searchParams.get("type"); // content, keyword, technical, backlink

  const suggestions = await prisma.aISuggestion.findMany({
    where: {
      productId,
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
 * POST /api/organizations/:slug/websites/:websiteId/products/:productId/suggestions
 * Generate new AI suggestions for a product
 */
export const POST = withUserAuth<RouteContext>(async (req, { params }) => {
  const { slug, websiteId, productId } = await params;
  const user = (req as unknown as AuthRequest).user;

  const product = await checkProductAccess(user.id, slug, websiteId, productId);
  if (!product) {
    return NextResponse.json(
      { success: false, error: "Product not found" },
      { status: 404 }
    );
  }

  // Get our page content
  const pageContents = product.website.pageAnalyses.map((p) => ({
    url: p.url,
    title: p.title,
    metaDescription: p.metaDescription,
    headings: p.headings as { h1: string[]; h2: string[]; h3: string[] },
    keywords: (
      p.keywords as Array<{ keyword: string; frequency: number }>
    ).slice(0, 10),
  }));

  // Get competitor pages for comparison
  const competitorPages = product.website.competitors.flatMap((c) =>
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
  const serpPerformance = product.serpResults
    .filter((r) => r.position !== null)
    .map((r) => ({
      position: r.position!,
      url: product.sourceUrl || product.website.url,
      title: r.title || product.name,
      snippet: r.snippet || "",
    }));

  // Build current page content (use first analysis or create from product)
  const currentPage = pageContents[0] || {
    url: product.sourceUrl || product.website.url,
    title: product.name,
    metaDescription: product.description || "",
    headings: { h1: [product.name], h2: [], h3: [] },
    keywords: product.keywords.map((k) => ({ keyword: k, frequency: 1 })),
  };

  // Generate suggestions using AI
  const aiSuggestions = await mistral.generateSEOSuggestions(
    product.name,
    product.keywords,
    currentPage,
    serpPerformance,
    competitorPages
  );

  // Save suggestions to database
  const createdSuggestions = [];
  for (const suggestion of aiSuggestions) {
    const created = await prisma.aISuggestion.create({
      data: {
        productId,
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
