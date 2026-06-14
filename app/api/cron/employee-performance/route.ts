import { NextResponse } from "next/server";
import { runEmployeePerformanceSnapshotCron } from "@/lib/employee-performance-cron-service";
import { isEmployeePerformanceCronAuthorized } from "@/lib/employee-performance-cron-utils";

export async function POST(request: Request) {
  try {
    if (!isEmployeePerformanceCronAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Yetkisiz cron isteği." },
        { status: 401 }
      );
    }

    const summary = await runEmployeePerformanceSnapshotCron();
    return NextResponse.json(summary);
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
