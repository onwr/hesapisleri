import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const run = await runCronJob("payment-reconciliation");
    return NextResponse.json(buildCronRouteResponse("payment-reconciliation", run));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Payment reconciliation cron başarısız.",
      },
      { status: 500 }
    );
  }
}
