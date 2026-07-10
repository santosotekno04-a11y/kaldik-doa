import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/sync-engine";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || process.env.SYNC_SECRET_TOKEN;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized — cron endpoint requires valid token" },
        { status: 401 }
      );
    }

    // Verify it's Tuesday (day 2) or forced
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, ...
    const force = request.nextUrl.searchParams.get("force") === "true";

    if (dayOfWeek !== 2 && !force) {
      return NextResponse.json({
        status: "skipped",
        message: `Bukan hari Selasa (hari ini: ${["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][dayOfWeek]}). Gunakan ?force=true untuk memaksa sync.`,
      });
    }

    const result = await runSync("cron");

    return NextResponse.json({
      status: "success",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: "error", message },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron (which uses GET)
export async function GET(request: NextRequest) {
  return POST(request);
}
