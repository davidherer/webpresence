import { NextRequest, NextResponse } from "next/server";
import { jobQueue } from "@/lib/jobs";

// Secret to protect cron endpoints
const CRON_SECRET = process.env.CRON_SECRET;

function validateCronRequest(req: NextRequest): boolean {
  // In development, allow without secret
  if (process.env.NODE_ENV === "development") return true;

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !CRON_SECRET) return false;

  return authHeader === `Bearer ${CRON_SECRET}`;
}

// POST /api/cron/process-jobs - Process pending jobs in the queue
export async function POST(req: NextRequest) {
  console.log("[Cron Process-Jobs] ===== Starting job processing =====");
  console.log("[Cron Process-Jobs] Environment:", process.env.NODE_ENV);
  console.log(
    "[Cron Process-Jobs] Auth header:",
    req.headers.get("authorization") ? "present" : "missing"
  );

  if (!validateCronRequest(req)) {
    console.log(
      "[Cron Process-Jobs] ❌ Unauthorized - invalid or missing credentials"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Process-Jobs] ✅ Authentication successful");

  try {
    console.log("[Cron Process-Jobs] Calling jobQueue.processJobQueue()...");
    const result = await jobQueue.processJobQueue();

    console.log("[Cron Process-Jobs] ✅ Job processing completed");
    console.log("[Cron Process-Jobs] Result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Cron Process-Jobs] ❌ Error processing jobs:", error);
    console.error(
      "[Cron Process-Jobs] Error stack:",
      error instanceof Error ? error.stack : "N/A"
    );
    return NextResponse.json(
      { success: false, error: "Failed to process jobs" },
      { status: 500 }
    );
  } finally {
    console.log("[Cron Process-Jobs] ===== Job processing finished =====");
  }
}

// GET endpoint for Vercel Cron compatibility
export async function GET(req: NextRequest) {
  return POST(req);
}
