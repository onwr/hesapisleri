import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected && process.env.NODE_ENV === "production") {
    throw new Error("CRON_SECRET production ortamında zorunludur.");
  }
  if (!expected) return true;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    if (!isMarketplaceFeatureEnabled()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Pazaryeri özelliği kapalı; senkronizasyon atlandı.",
        jobKey: "marketplace-sync",
      });
    }

    const run = await runCronJob("marketplace-sync");
    return NextResponse.json(buildCronRouteResponse("marketplace-sync", run));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Cron senkronizasyonu başarısız.",
      },
      { status: 500 }
    );
  }
}
