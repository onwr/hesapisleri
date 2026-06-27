import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Yetkisiz." }, { status: 401 });
  }

  try {
    const run = await runCronJob("membership-campaign-lifecycle");
    return NextResponse.json(buildCronRouteResponse("membership-campaign-lifecycle", run));
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Cron başarısız.",
      },
      { status: 500 }
    );
  }
}
