import { prisma } from "@/lib/db";
import { analysis, serp } from "@/lib/analysis";
import { mistral } from "@/lib/mistral";
import type { AnalysisJobType, JobPayload } from "@/types";

const MAX_CONCURRENT_JOBS = 5;
const JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Process a single job based on its type
 */
async function processJob(
  jobId: string,
  type: AnalysisJobType,
  websiteId: string,
  payload: JobPayload
): Promise<JobResult> {
  console.log(`\n      ┌─ Traitement interne du job`);
  console.log(`      │  Job ID: ${jobId.substring(0, 8)}...`);
  console.log(`      │  Type: ${type}`);
  console.log(`      │  Website: ${websiteId.substring(0, 8)}...`);
  console.log(`      └─ Démarrage...`);

  switch (type) {
    case "initial_analysis":
      console.log(`      → Analyse initiale du site web`);
      const initialResult = await analysis.runInitialAnalysis(websiteId);
      console.log(
        `      ← Analyse initiale terminée: ${
          initialResult.success ? "✅" : "❌"
        }`
      );
      return {
        success: initialResult.success,
        data: initialResult,
        error: initialResult.error,
      };

    case "sitemap_fetch":
      console.log(`      → Récupération du sitemap`);
      // Import dynamically to avoid circular dependencies
      const { brightdata } = await import("@/lib/brightdata");
      const { storage } = await import("@/lib/storage");

      // Get website data
      console.log(`      → Récupération des données du website...`);
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });

      if (!website) {
        console.log(`      ✗ Website non trouvé`);
        return { success: false, error: "Website not found" };
      }

      const websiteUrl = payload.websiteUrl || website.url;
      const selectedSitemaps = payload.selectedSitemaps || [];

      console.log(`      → URL cible: ${websiteUrl}`);
      console.log(
        `      → Sitemaps sélectionnés: ${
          selectedSitemaps.length || "Aucun (auto-détection)"
        }`
      );

      try {
        // Fetch the sitemap
        console.log(
          `      → Récupération du sitemap principal via BrightData...`
        );
        const sitemapResult = await brightdata.fetchSitemap(websiteUrl);
        console.log(`      ✓ Sitemap trouvé: ${sitemapResult.sitemapUrl}`);
        console.log(`      ✓ ${sitemapResult.urls.length} URLs trouvées`);

        // Si c'est un sitemap index et qu'on a des sitemaps sélectionnés
        let allUrls = sitemapResult.urls;

        if (selectedSitemaps.length > 0) {
          console.log(
            `      → Récupération de ${selectedSitemaps.length} sous-sitemaps...`
          );
          // Fetch selected sub-sitemaps
          const subSitemapUrls: any[] = [];
          for (const subSitemapUrl of selectedSitemaps) {
            try {
              console.log(`        - Fetch: ${subSitemapUrl}`);
              const subResult = await brightdata.fetchSitemap(subSitemapUrl);
              console.log(`          ✓ ${subResult.urls.length} URLs`);
              subSitemapUrls.push(...subResult.urls);
            } catch (err) {
              console.error(
                `          ✗ Échec: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }
          }
          allUrls = subSitemapUrls;
          console.log(`      ✓ Total: ${allUrls.length} URLs récupérées`);
        }

        // Store in Vercel Blob
        console.log(`      → Stockage dans Vercel Blob...`);
        const blobResult = await storage.storeSitemap(
          websiteId,
          sitemapResult.sitemapUrl,
          {
            urls: allUrls,
            sitemapUrl: sitemapResult.sitemapUrl,
            timestamp: sitemapResult.timestamp,
          }
        );

        // Create snapshot in database
        await prisma.sitemapSnapshot.create({
          data: {
            websiteId,
            sitemapUrl: sitemapResult.sitemapUrl,
            blobUrl: blobResult.url,
            urlCount: allUrls.length,
            fetchedAt: new Date(),
            sitemapType: selectedSitemaps.length > 0 ? "subset" : "single",
            metadata: {
              selectedSitemaps,
            },
          },
        });

        // Update website record
        await prisma.website.update({
          where: { id: websiteId },
          data: {
            sitemapUrl: sitemapResult.sitemapUrl,
            lastSitemapFetch: new Date(),
          },
        });

        return { success: true, data: { urlCount: allUrls.length } };
      } catch (err: any) {
        console.error(`Sitemap fetch error:`, err);
        return { success: false, error: err.message };
      }

    case "page_scrape":
      console.log(
        `[JobQueue processJob] Page scrape with ${
          payload.urls?.length || 0
        } URLs`
      );
      if (payload.urls && payload.urls.length > 0) {
        // TODO: Implement page scraping
        return { success: true };
      }
      return { success: false, error: "No URLs provided" };

    case "serp_analysis":
      console.log(
        `[JobQueue processJob] SERP analysis - searchQueryId: ${
          payload.searchQueryId
        }, query: ${payload.query || "N/A"}`
      );
      if (payload.searchQueryId && payload.query) {
        console.log(`[JobQueue processJob] Calling serp.runSerpAnalysis...`);
        const serpResult = await serp.runSerpAnalysis(
          websiteId,
          payload.searchQueryId,
          [payload.query] // Single query per search query
        );
        console.log(`[JobQueue processJob] SERP analysis completed`);
        return { success: true, data: serpResult };
      }
      console.log(
        `[JobQueue processJob] SERP analysis failed - missing searchQueryId or query`
      );
      return { success: false, error: "Missing searchQueryId or query" };

    case "ai_report":
      console.log(
        `[JobQueue processJob] AI report - type: ${payload.reportType}`
      );
      if (payload.reportType) {
        // Generate AI report based on type
        const website = await prisma.website.findUnique({
          where: { id: websiteId },
          include: {
            searchQueries: { where: { isActive: true } },
            competitors: { where: { isActive: true } },
          },
        });

        if (!website) {
          console.log(`[JobQueue processJob] Website ${websiteId} not found`);
          return { success: false, error: "Website not found" };
        }

        if (payload.reportType === "periodic_recap") {
          console.log(
            `[JobQueue processJob] Generating periodic recap for ${website.name}`
          );
          // Get SERP data for the period
          const periodDays = 30; // Default to 30 days
          const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

          const searchQueriesData = await Promise.all(
            website.searchQueries.map(async (searchQuery) => {
              const currentResults = await prisma.serpResult.findMany({
                where: {
                  searchQueryId: searchQuery.id,
                  createdAt: { gte: since },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
              });

              return {
                name: searchQuery.query,
                keywords: [searchQuery.query],
                currentPositions: currentResults.map((r) => ({
                  query: r.query,
                  position: r.position,
                })),
                previousPositions: [], // Would need historical data
              };
            })
          );

          const competitorsData = await Promise.all(
            website.competitors.map(async (competitor) => {
              const results = await prisma.serpResult.findMany({
                where: {
                  competitorId: competitor.id,
                  createdAt: { gte: since },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
              });

              return {
                name: competitor.name,
                url: competitor.url,
                positions: results.map((r) => ({
                  query: r.query,
                  position: r.position,
                })),
              };
            })
          );

          console.log(
            `[JobQueue processJob] Calling Mistral AI for report generation...`
          );
          const report = await mistral.generatePeriodicRecap(
            website.name,
            searchQueriesData,
            competitorsData,
            periodDays
          );

          await prisma.aIReport.create({
            data: {
              websiteId,
              type: "periodic_recap",
              title: report.title,
              content: report.content,
              metadata: { highlights: report.highlights },
            },
          });

          console.log(
            `[JobQueue processJob] Periodic recap generated successfully`
          );
          return { success: true, data: report };
        }
      }
      return { success: false, error: "Missing report type" };

    default:
      console.log(`[JobQueue processJob] Unknown job type: ${type}`);
      return { success: false, error: `Unknown job type: ${type}` };
  }
}

/**
 * Process pending jobs from the queue
 * This should be called by a cron job or worker
 */
export async function processJobQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const startTime = Date.now();
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║  🔄 DÉMARRAGE DU TRAITEMENT DE LA QUEUE                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`⏰ Heure: ${new Date().toLocaleString("fr-FR")}`);
  console.log(`📋 Recherche de jobs en attente...`);

  // Get pending jobs, ordered by priority and schedule time
  const pendingJobs = await prisma.analysisJob.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: new Date() },
      attempts: { lt: prisma.analysisJob.fields.maxAttempts },
    },
    orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
    take: MAX_CONCURRENT_JOBS,
  });

  console.log(
    `\n📊 Résultat de la recherche: ${pendingJobs.length} job(s) trouvé(s)`
  );

  if (pendingJobs.length === 0) {
    console.log("✅ Aucun job en attente. Queue vide.");
    console.log(`⏱️  Durée: ${Date.now() - startTime}ms\n`);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Afficher les détails des jobs trouvés
  console.log("\n📦 Jobs à traiter:");
  console.log("─".repeat(60));
  pendingJobs.forEach((job, index) => {
    console.log(`${index + 1}. Job #${job.id.substring(0, 8)}...`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Priorité: ${job.priority}`);
    console.log(`   Tentative: ${job.attempts + 1}/${job.maxAttempts}`);
    console.log(`   WebsiteId: ${job.websiteId.substring(0, 8)}...`);
    console.log(
      `   Programmé pour: ${job.scheduledAt.toLocaleString("fr-FR")}`
    );
    if (Object.keys(job.payload as any).length > 0) {
      console.log(
        `   Payload:`,
        JSON.stringify(job.payload, null, 2)
          .split("\n")
          .map((line, i) => (i === 0 ? line : `            ${line}`))
          .join("\n")
      );
    }
    console.log("");
  });
  console.log("─".repeat(60) + "\n");

  let succeeded = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    const jobStartTime = Date.now();
    console.log(`\n🔧 TRAITEMENT DU JOB #${job.id.substring(0, 8)}...`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Tentative ${job.attempts + 1}/${job.maxAttempts}`);

    try {
      // Mark as running
      console.log(`   ⏳ Marquage du job comme "running"...`);
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: "running",
          startedAt: new Date(),
          attempts: job.attempts + 1,
        },
      });

      console.log(`   ✅ Job marqué comme "running"`);
      console.log(`   🚀 Exécution du job...`);

      // Process with timeout
      const result = await Promise.race([
        processJob(
          job.id,
          job.type as AnalysisJobType,
          job.websiteId,
          (job.payload as JobPayload) || {}
        ),
        new Promise<JobResult>((_, reject) =>
          setTimeout(() => reject(new Error("Job timeout")), JOB_TIMEOUT_MS)
        ),
      ]);

      const jobDuration = Date.now() - jobStartTime;
      console.log(`   ⏱️  Durée d'exécution: ${jobDuration}ms`);
      console.log(`   Résultat: ${result.success ? "✅ SUCCÈS" : "❌ ÉCHEC"}`);
      if (result.error) {
        console.log(`   Erreur: ${result.error}`);
      }
      if (result.data) {
        console.log(
          `   Données retournées:`,
          typeof result.data === "object"
            ? JSON.stringify(result.data).substring(0, 100) + "..."
            : result.data
        );
      }

      // Update job status
      console.log(`   💾 Mise à jour du statut du job...`);
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: result.success ? "completed" : "failed",
          completedAt: new Date(),
          result: result.data as object,
          error: result.error,
        },
      });

      if (result.success) {
        console.log(`   ✅ JOB RÉUSSI #${job.id.substring(0, 8)}...`);
        succeeded++;
      } else {
        console.log(`   ❌ JOB ÉCHOUÉ #${job.id.substring(0, 8)}...`);
        console.log(`      Raison: ${result.error}`);
        failed++;
      }
    } catch (error) {
      const jobDuration = Date.now() - jobStartTime;
      console.error(`\n   ⚠️  ERREUR LORS DU TRAITEMENT (${jobDuration}ms)`);
      console.error(
        `   Type d'erreur:`,
        error instanceof Error ? error.name : typeof error
      );
      console.error(
        `   Message:`,
        error instanceof Error ? error.message : String(error)
      );
      if (error instanceof Error && error.stack) {
        console.error(
          `   Stack trace:`,
          error.stack.split("\n").slice(0, 3).join("\n   ")
        );
      }

      // Mark as failed (might retry if under max attempts)
      const shouldRetry = job.attempts + 1 < job.maxAttempts;
      const nextRetryIn = shouldRetry ? Math.pow(2, job.attempts) * 60 : 0;

      console.log(
        `   🔄 Stratégie: ${
          shouldRetry
            ? `RETRY dans ${nextRetryIn}min`
            : "ABANDON (max tentatives atteint)"
        }`
      );

      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? "pending" : "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          completedAt: shouldRetry ? null : new Date(),
          // Exponential backoff for retry
          scheduledAt: shouldRetry
            ? new Date(Date.now() + Math.pow(2, job.attempts) * 60 * 1000)
            : undefined,
        },
      });

      failed++;
    }
  }

  const totalDuration = Date.now() - startTime;
  const summary = {
    processed: pendingJobs.length,
    succeeded,
    failed,
  };

  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║  ✅ TRAITEMENT DE LA QUEUE TERMINÉ                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`📊 Résumé:`);
  console.log(`   Total traité: ${summary.processed} job(s)`);
  console.log(`   ✅ Réussis: ${summary.succeeded}`);
  console.log(`   ❌ Échecs: ${summary.failed}`);
  console.log(`   ⏱️  Durée totale: ${totalDuration}ms`);
  console.log(
    `   ⚡ Moyenne: ${
      summary.processed > 0 ? Math.round(totalDuration / summary.processed) : 0
    }ms/job\n`
  );

  return summary;
}

/**
 * Schedule periodic jobs for all active websites
 * This should be called by a daily cron job
 */
export async function schedulePeriodicJobs(): Promise<number> {
  const organizations = await prisma.organization.findMany({
    include: {
      websites: {
        where: { status: "active" },
        include: {
          searchQueries: {
            where: { isActive: true },
            select: { id: true, query: true },
          },
        },
      },
    },
  });

  let jobsCreated = 0;

  for (const org of organizations) {
    for (const website of org.websites) {
      // Check if SERP analysis is due
      const lastSerpJob = await prisma.analysisJob.findFirst({
        where: {
          websiteId: website.id,
          type: "serp_analysis",
          status: "completed",
        },
        orderBy: { completedAt: "desc" },
      });

      const serpDue =
        !lastSerpJob ||
        (lastSerpJob.completedAt &&
          Date.now() - lastSerpJob.completedAt.getTime() >
            org.serpFrequencyHours * 60 * 60 * 1000);

      if (serpDue) {
        // Schedule SERP analysis for each search query
        for (const searchQuery of website.searchQueries) {
          await prisma.analysisJob.create({
            data: {
              websiteId: website.id,
              type: "serp_analysis",
              payload: {
                searchQueryId: searchQuery.id,
                query: searchQuery.query,
              },
              priority: 3,
            },
          });
          jobsCreated++;
        }
      }

      // Check if AI report is due
      const lastReportJob = await prisma.analysisJob.findFirst({
        where: {
          websiteId: website.id,
          type: "ai_report",
          status: "completed",
        },
        orderBy: { completedAt: "desc" },
      });

      const reportDue =
        !lastReportJob ||
        (lastReportJob.completedAt &&
          Date.now() - lastReportJob.completedAt.getTime() >
            org.aiReportFrequencyHours * 60 * 60 * 1000);

      if (reportDue) {
        await prisma.analysisJob.create({
          data: {
            websiteId: website.id,
            type: "ai_report",
            payload: { reportType: "periodic_recap" },
            priority: 2,
          },
        });
        jobsCreated++;
      }
    }
  }

  return jobsCreated;
}

export const jobQueue = {
  processJobQueue,
  schedulePeriodicJobs,
};
