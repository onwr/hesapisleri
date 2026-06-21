import { NextResponse } from "next/server";
import { runMembershipCampaignLifecycle } from "@/lib/admin/promotions/campaign-lifecycle-service";

export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Yetkisiz." }, { status: 401 });
  }

  const result = await runMembershipCampaignLifecycle();
  return NextResponse.json({ success: true, data: result });
}
