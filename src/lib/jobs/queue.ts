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
  console.log(`[JobQueue processJob] Starting job ${jobId} of type ${type}`);
  console.log(`[JobQueue processJob] Payload:`, payload);

  switch (type) {
    case "initial_analysis":
      console.log(
        `[JobQueue processJob] Running initial analysis for website ${websiteId}`
      );
      const initialResult = await analysis.runInitialAnalysis(websiteId);
      console.log(`[JobQueue processJob] Initial analysis result:`, {
        success: initialResult.success,
        error: initialResult.error,
      });
      return {
        success: initialResult.success,
        data: initialResult,
        error: initialResult.error,
      };

    case "sitemap_fetch":
      console.log(
        `[JobQueue processJob] Sitemap fetch (handled as part of initial analysis)`
      );
      // Handled as part of initial analysis for now
      return { success: true };

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
  console.log("[JobQueue] ===== Starting job queue processing =====");

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

  console.log(`[JobQueue] Found ${pendingJobs.length} pending jobs to process`);

  if (pendingJobs.length === 0) {
    console.log("[JobQueue] No pending jobs, exiting");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(
    "[JobQueue] Jobs details:",
    pendingJobs.map((j) => ({
      id: j.id,
      type: j.type,
      priority: j.priority,
      attempts: j.attempts,
      websiteId: j.websiteId,
    }))
  );

  let succeeded = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    console.log(
      `[JobQueue] Processing job ${job.id} (type: ${job.type}, attempt: ${
        job.attempts + 1
      }/${job.maxAttempts})`
    );

    try {
      // Mark as running
      console.log(`[JobQueue] Marking job ${job.id} as running...`);
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: "running",
          startedAt: new Date(),
          attempts: job.attempts + 1,
        },
      });

      console.log(
        `[JobQueue] Executing job ${job.id} with payload:`,
        job.payload
      );

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

      console.log(`[JobQueue] Job ${job.id} completed with result:`, {
        success: result.success,
        error: result.error,
      });

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
        console.log(`[JobQueue] ✅ Job ${job.id} succeeded`);
        succeeded++;
      } else {
        console.log(`[JobQueue] ❌ Job ${job.id} failed: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.error(`[JobQueue] ❌ Error processing job ${job.id}:`, error);
      console.error(
        `[JobQueue] Error details:`,
        error instanceof Error ? error.stack : error
      );

      // Mark as failed (might retry if under max attempts)
      const shouldRetry = job.attempts + 1 < job.maxAttempts;

      console.log(
        `[JobQueue] Job ${job.id} will ${
          shouldRetry ? "be retried" : "NOT be retried"
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

  const summary = {
    processed: pendingJobs.length,
    succeeded,
    failed,
  };

  console.log("[JobQueue] ===== Job processing complete =====");
  console.log("[JobQueue] Summary:", summary);

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
