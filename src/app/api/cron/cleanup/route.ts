import { NextRequest, NextResponse } from "next/server";
import { dbOperations } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Optional secret check if CRON_SECRET is set in environment
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clean events expired more than 30 days ago
    const result = await dbOperations.cleanExpiredEvents(30);

    return NextResponse.json(
      {
        success: true,
        message: "Expired events cleanup completed.",
        cutoff_date: result.cutoff_date,
        executed_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to execute cleanup.",
      },
      { status: 500 }
    );
  }
}
