import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Globe, Users, Settings, ArrowLeft, BarChart3, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizationPage({ params }: PageProps) {
  const { slug } = await params;
  const user = await getUserSession();
  if (!user) redirect("/");

  // Check access
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId: user.id,
      organization: { slug },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) notFound();

  const { organization, role } = membership;

  // Fetch websites with stats
  const websites = await prisma.website.findMany({
    where: { organizationId: organization.id },
    include: {
      _count: { select: { products: true, competitors: true, aiReports: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch members
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: organization.id },
    include: { user: { select: { email: true, name: true } } },
  });

  const isOwnerOrAdmin = ["owner", "admin"].includes(role);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "analyzing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Loader2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Actif";
      case "analyzing":
        return "En cours d'analyse";
      case "error":
        return "Erreur";
      default:
        return "En attente";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Toutes les organisations
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{organization.name}</h1>
          <p className="text-muted-foreground mt-1">
            {role === "owner"
              ? "Propriétaire"
              : role === "admin"
              ? "Administrateur"
              : "Membre"}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwnerOrAdmin && (
            <Link href={`/dashboard/o/${slug}/settings`}>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Paramètres
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sites web</CardDescription>
            <CardTitle className="text-3xl">{websites.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Produits/Services suivis</CardDescription>
            <CardTitle className="text-3xl">
              {websites.reduce((acc, w) => acc + w._count.products, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Membres</CardDescription>
            <CardTitle className="text-3xl">{members.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Websites section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sites web</h2>
          <Link href={`/dashboard/o/${slug}/websites/new`}>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un site
            </Button>
          </Link>
        </div>

        {websites.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Globe className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun site web</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Ajoutez votre premier site web pour commencer l&apos;analyse SEO.
              </p>
              <Link href={`/dashboard/o/${slug}/websites/new`}>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un site
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {websites.map((website) => (
              <Link key={website.id} href={`/dashboard/o/${slug}/w/${website.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{website.name}</CardTitle>
                        <CardDescription className="truncate max-w-xs">
                          {website.url}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        {getStatusIcon(website.status)}
                        <span className="text-muted-foreground">{getStatusText(website.status)}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {website._count.products} produit{website._count.products !== 1 ? "s" : ""}
                      </div>
                      <div>
                        {website._count.competitors} concurrent{website._count.competitors !== 1 ? "s" : ""}
                      </div>
                      <div>
                        {website._count.aiReports} rapport{website._count.aiReports !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Members section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Membres</h2>
          {isOwnerOrAdmin && (
            <Link href={`/dashboard/o/${slug}/members`}>
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Gérer
              </Button>
            </Link>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{member.user.name || member.user.email}</p>
                    {member.user.name && (
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {member.role === "owner"
                      ? "Propriétaire"
                      : member.role === "admin"
                      ? "Admin"
                      : "Membre"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
