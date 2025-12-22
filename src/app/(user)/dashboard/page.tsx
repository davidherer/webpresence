"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Globe, Building2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  _count: {
    websites: number;
    members: number;
  };
}

interface Membership {
  id: string;
  role: string;
  organization: Organization;
}

interface DashboardData {
  user: User;
  memberships: Membership[];
}

export default function UserDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch("/api/dashboard");
        if (response.ok) {
          const dashboardData = await response.json();
          setData(dashboardData);
        }
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Erreur de chargement</p>
      </div>
    );
  }

  const { user, memberships } = data;
  const hasOrganizations = memberships.length > 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Bienvenue, {user.name || user.email}</h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos organisations et sites web
          </p>
        </div>
        <Link href="/dashboard/organizations/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle organisation
          </Button>
        </Link>
      </div>

      {!hasOrganizations ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune organisation</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Créez votre première organisation pour commencer à gérer vos sites web et suivre leur visibilité.
            </p>
            <Link href="/dashboard/organizations/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer une organisation
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => (
            <Link
              key={membership.organization.id}
              href={`/dashboard/o/${membership.organization.slug}`}
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {membership.organization.name}
                  </CardTitle>
                  <CardDescription>
                    {membership.role === "owner"
                      ? "Propriétaire"
                      : membership.role === "admin"
                      ? "Administrateur"
                      : "Membre"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Globe className="w-4 h-4" />
                      {membership.organization._count.websites} site
                      {membership.organization._count.websites !== 1 ? "s" : ""}
                    </div>
                    <div>
                      {membership.organization._count.members} membre
                      {membership.organization._count.members !== 1 ? "s" : ""}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
