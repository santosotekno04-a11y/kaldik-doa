import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync/sync-engine";

export async function POST(request: NextRequest) {
  try {
    // Optional: check secret token for security
    const authHeader = request.headers.get("authorization");
    const syncToken = process.env.SYNC_SECRET_TOKEN;

    if (syncToken && authHeader !== `Bearer ${syncToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await runSync("manual");

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
