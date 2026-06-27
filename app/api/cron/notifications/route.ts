import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

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

    const run = await runCronJob("notifications");
    return NextResponse.json(buildCronRouteResponse("notifications", run));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Bildirim cron işlemi başarısız.",
      },
      { status: 500 }
    );
  }
}
