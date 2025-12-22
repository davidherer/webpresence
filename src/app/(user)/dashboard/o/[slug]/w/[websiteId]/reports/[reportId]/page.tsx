import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth/user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string; websiteId: string; reportId: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { slug, websiteId, reportId } = await params;
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

  // Fetch report
  const report = await prisma.aIReport.findFirst({
    where: {
      id: reportId,
      websiteId,
      website: { organizationId: membership.organization.id },
    },
    include: {
      website: { select: { name: true } },
    },
  });

  if (!report) notFound();

  const typeLabels: Record<string, string> = {
    initial_analysis: "Analyse initiale",
    periodic_recap: "Récap périodique",
    competitor_analysis: "Analyse concurrentielle",
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Link
        href={`/dashboard/o/${slug}/w/${websiteId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Retour au site
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-sm">{typeLabels[report.type] || report.type}</span>
            <span className="text-sm">•</span>
            <span className="text-sm">
              {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <CardTitle className="text-2xl">{report.title}</CardTitle>
          <CardDescription>
            {report.website.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-slate dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{
              __html: report.content
                .replace(/^# /gm, '<h1 class="text-2xl font-bold mt-8 mb-4">')
                .replace(/^## /gm, '<h2 class="text-xl font-semibold mt-6 mb-3">')
                .replace(/^### /gm, '<h3 class="text-lg font-medium mt-4 mb-2">')
                .replace(/^\* /gm, '<li class="ml-4">')
                .replace(/^\d+\. /gm, '<li class="ml-4 list-decimal">')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\n\n/g, '</p><p class="my-4">')
                .replace(/\n/g, '<br/>')
            }}
          />
        </CardContent>
      </Card>

      {/* Metadata if available */}
      {report.metadata && typeof report.metadata === "object" && "highlights" in report.metadata && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Points clés</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(report.metadata as { highlights: string[] }).highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
