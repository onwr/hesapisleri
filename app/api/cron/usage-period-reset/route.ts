import { NextResponse } from "next/server";
import { buildCronRouteResponse } from "@/lib/admin/jobs/cron-response";
import { runCronJob } from "@/lib/admin/jobs/job-run-service";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await runCronJob("usage-period-reset");
    return NextResponse.json(buildCronRouteResponse("usage-period-reset", run));
  } catch (error) {
    console.error("USAGE_PERIOD_RESET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Usage reset başarısız." },
      { status: 500 }
    );
  }
}
