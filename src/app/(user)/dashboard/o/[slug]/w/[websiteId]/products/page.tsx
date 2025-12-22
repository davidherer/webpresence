import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string }>;
}

export default async function ProductsPage({ params }: PageProps) {
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

  if (!membership) {
    notFound();
  }

  // Get website with products
  const website = await prisma.website.findFirst({
    where: {
      id: websiteId,
      organizationId: membership.organizationId,
    },
    include: {
      products: {
        orderBy: { createdAt: "desc" },
        include: {
          serpResults: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!website) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/o/${slug}/w/${websiteId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au site
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Produits & Services</h1>
            <p className="text-muted-foreground">{website.name}</p>
          </div>
        </div>
      </div>

      {/* Products list */}
      {website.products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun produit identifié</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              L'analyse initiale n'a pas encore identifié de produits ou services. Relancez l'analyse depuis la page
              du site.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {website.products.map((product) => {
            const latestSerp = product.serpResults[0];
            const previousPosition = latestSerp?.position ? latestSerp.position + 5 : null; // Mock for trend

            return (
              <Card key={product.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {product.name}
                        {!product.isActive && (
                          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-1 rounded">
                            Inactif
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-2">{product.description}</CardDescription>
                    </div>
                    {latestSerp && (
                      <div className="flex items-center gap-2 ml-4">
                        {previousPosition && latestSerp.position < previousPosition ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : previousPosition && latestSerp.position > previousPosition ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                          <Minus className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-2xl font-bold">#{latestSerp.position}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Mots-clés principaux</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.keywords.slice(0, 10).map((keyword, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    {product.sourceUrl && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Source</h4>
                        <a
                          href={product.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {product.sourceUrl}
                        </a>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Confiance: {Math.round(product.confidence * 100)}%
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/o/${slug}/w/${websiteId}/products/${product.id}`}>
                          Voir les détails
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
