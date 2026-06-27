import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/db-health";

export async function GET() {
  try {
    const result = await checkDatabaseHealth();
    if (!result.success) {
      return NextResponse.json(
        { ok: false, status: "not_ready" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: "ready",
      latencyMs: result.latencyMs,
    });
  } catch {
    return NextResponse.json(
      { ok: false, status: "not_ready" },
      { status: 503 }
    );
  }
}
