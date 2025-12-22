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
      // Handled as part of initial analysis for now
      return { success: true };

    case "page_scrape":
      if (payload.urls && payload.urls.length > 0) {
        // TODO: Implement page scraping
        return { success: true };
      }
      return { success: false, error: "No URLs provided" };

    case "serp_analysis":
      if (payload.productId && payload.queries) {
        const serpResult = await serp.runSerpAnalysis(
          websiteId,
          payload.productId,
          payload.queries as string[]
        );
        return { success: true, data: serpResult };
      }
      return { success: false, error: "Missing productId or queries" };

    case "ai_report":
      if (payload.reportType) {
        // Generate AI report based on type
        const website = await prisma.website.findUnique({
          where: { id: websiteId },
          include: {
            products: { where: { isActive: true } },
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

          const productsData = await Promise.all(
            website.products.map(async (product) => {
              const currentResults = await prisma.serpResult.findMany({
                where: { productId: product.id, createdAt: { gte: since } },
                orderBy: { createdAt: "desc" },
                take: 10,
              });

              return {
                name: product.name,
                keywords: product.keywords,
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
            productsData,
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
      console.error(`[JobQueue] Error processing job ${job.id}:`, error);

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
          products: {
            where: { isActive: true },
            select: { id: true, keywords: true },
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
        // Schedule SERP analysis for each product
        for (const product of website.products) {
          await prisma.analysisJob.create({
            data: {
              websiteId: website.id,
              type: "serp_analysis",
              payload: {
                productId: product.id,
                queries: product.keywords.slice(0, 5),
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
