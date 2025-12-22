import { NextRequest, NextResponse } from "next/server";
import { jobQueue } from "@/lib/jobs";

const CRON_SECRET = process.env.CRON_SECRET;

function validateCronRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "development") return true;

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !CRON_SECRET) return false;

  return authHeader === `Bearer ${CRON_SECRET}`;
}

// POST /api/cron/schedule-jobs - Schedule periodic jobs for all websites
export async function POST(req: NextRequest) {
  if (!validateCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const jobsCreated = await jobQueue.schedulePeriodicJobs();

    return NextResponse.json({
      success: true,
      data: { jobsCreated },
    });
  } catch (error) {
    console.error("[Cron] Error scheduling jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to schedule jobs" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
