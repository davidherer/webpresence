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
  switch (type) {
    case "initial_analysis":
      const initialResult = await analysis.runInitialAnalysis(websiteId);
      return {
        success: initialResult.success,
        data: initialResult,
        error: initialResult.error,
      };

    case "sitemap_fetch":
      // Import dynamically to avoid circular dependencies
      const { brightdata } = await import("@/lib/brightdata");
      const { storage } = await import("@/lib/storage");

      // Get website data
      const website = await prisma.website.findUnique({
        where: { id: websiteId },
      });

      if (!website) {
        return { success: false, error: "Website not found" };
      }

      const websiteUrl = payload.websiteUrl || website.url;
      const selectedSitemaps = payload.selectedSitemaps || [];

      try {
        // Fetch the sitemap
        const sitemapResult = await brightdata.fetchSitemap(websiteUrl);

        // Si c'est un sitemap index et qu'on a des sitemaps sélectionnés
        let allUrls = sitemapResult.urls;

        if (selectedSitemaps.length > 0) {
          // Fetch selected sub-sitemaps
          const subSitemapUrls: any[] = [];
          for (const subSitemapUrl of selectedSitemaps) {
            try {
              const subResult = await brightdata.fetchSitemap(subSitemapUrl);
              subSitemapUrls.push(...subResult.urls);
            } catch (err) {
              // Silently continue on sub-sitemap errors
            }
          }
          allUrls = subSitemapUrls;
        }

        // Store in Vercel Blob
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
        return { success: false, error: err.message };
      }

    case "page_scrape":
      if (payload.urls && payload.urls.length > 0) {
        // TODO: Implement page scraping
        return { success: true };
      }
      return { success: false, error: "No URLs provided" };

    case "page_extraction":
      if (!payload.extractionId || !payload.url || !payload.extractionType) {
        return {
          success: false,
          error: "Missing extractionId, url or extractionType",
        };
      }

      try {
        // Import module d'extraction
        const { extractPage } = await import("@/lib/extraction");

        // Effectuer l'extraction
        const extractionResult = await extractPage(
          websiteId,
          payload.url,
          payload.extractionType
        );

        // Mettre à jour l'enregistrement PageExtraction
        const updateData: any = {
          status: "completed",
          type: payload.extractionType,
          htmlBlobUrl: extractionResult.htmlBlobUrl,
          extractedAt: new Date(),
          error: null,
        };

        // Ajouter les données selon le type d'extraction
        if (payload.extractionType === "quick" && extractionResult.quick) {
          updateData.title = extractionResult.quick.title;
          updateData.metaDescription = extractionResult.quick.metaDescription;
          updateData.h1 = extractionResult.quick.h1;
        } else if (payload.extractionType === "full" && extractionResult.full) {
          updateData.title = extractionResult.full.title;
          updateData.metaDescription = extractionResult.full.metaDescription;
          updateData.h1 = extractionResult.full.h1;
          updateData.headings = extractionResult.full.headings;
          updateData.keywords = extractionResult.full.keywords;
        }

        await prisma.pageExtraction.update({
          where: { id: payload.extractionId },
          data: updateData,
        });

        return {
          success: true,
          data: { extractionId: payload.extractionId },
        };
      } catch (err: any) {
        // Mettre à jour avec l'erreur
        await prisma.pageExtraction.update({
          where: { id: payload.extractionId },
          data: {
            status: "failed",
            error: err.message || "Unknown error",
          },
        });

        return { success: false, error: err.message };
      }

    case "serp_analysis":
      if (payload.searchQueryId && payload.query) {
        const serpResult = await serp.runSerpAnalysis(
          websiteId,
          payload.searchQueryId,
          [payload.query] // Single query per search query
        );
        return { success: true, data: serpResult };
      }
      return { success: false, error: "Missing searchQueryId or query" };

    case "ai_report":
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
          return { success: false, error: "Website not found" };
        }

        if (payload.reportType === "periodic_recap") {
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

          return { success: true, data: report };
        }
      }
      return { success: false, error: "Missing report type" };

    default:

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

  if (pendingJobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    try {
      // Mark as running
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: "running",
          startedAt: new Date(),
          attempts: job.attempts + 1,
        },
      });

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

      // Update job status
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
        succeeded++;
      } else {
        failed++;
      }
    } catch (error) {

      // Mark as failed (might retry if under max attempts)
      const shouldRetry = job.attempts + 1 < job.maxAttempts;

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

  return {
    processed: pendingJobs.length,
    succeeded,
    failed,
  };
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
