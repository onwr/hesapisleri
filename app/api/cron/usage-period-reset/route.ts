import { NextResponse } from "next/server";
import { resetExpiredUsagePeriods } from "@/lib/billing/usage/usage-period-service";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resetExpiredUsagePeriods();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("USAGE_PERIOD_RESET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Usage reset başarısız." },
      { status: 500 }
    );
  }
}
