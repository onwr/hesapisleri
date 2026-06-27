import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";
import { isEmployeePerformanceCronAuthorized } from "@/lib/employee-performance-cron-utils";

export async function POST(request: Request) {
  try {
    if (!isEmployeePerformanceCronAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const run = await runCronJob("employee-performance");
    return NextResponse.json(buildCronRouteResponse("employee-performance", run));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Performans snapshot cron işlemi başarısız.",
      },
      { status: 500 }
    );
  }
}
