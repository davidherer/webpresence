"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Globe, Users, Settings, ArrowLeft, BarChart3, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface Website {
  id: string;
  name: string;
  url: string;
  status: string;
  _count: {
    searchQueries: number;
    competitors: number;
    aiReports: number;
  };
}

interface Member {
  id: string;
  role: string;
  user: {
    email: string;
    name: string | null;
  };
}

interface OrganizationData {
  organization: Organization;
  role: string;
  websites: Website[];
  members: Member[];
}

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

export default function OrganizationPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const [data, setData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`/api/organizations/${slug}/dashboard`);
        if (response.ok) {
          const organizationData = await response.json();
          setData(organizationData);
        } else if (response.status === 404) {
          setError(true);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load organization data:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-lg text-muted-foreground">Organisation introuvable</p>
        <Link href="/dashboard">
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour au dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const { organization, role, websites, members } = data;
  const isOwnerOrAdmin = ["owner", "admin"].includes(role);

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
            <CardDescription>Requêtes de recherche</CardDescription>
            <CardTitle className="text-3xl">
              {websites.reduce((acc, w) => acc + w._count.searchQueries, 0)}
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
                        {website._count.searchQueries} requête{website._count.searchQueries !== 1 ? "s" : ""}
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
