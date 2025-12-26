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
  if (!validateCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await jobQueue.processJobQueue();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[Cron] Error processing jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process jobs" },
      { status: 500 }
    );
  }
}

// GET endpoint for Vercel Cron compatibility
export async function GET(req: NextRequest) {
  return POST(req);
}
