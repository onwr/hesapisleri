import { NextResponse } from "next/server";
import { requirePartnerApi } from "@/lib/partner-auth";
import { listPartnerEarnings } from "@/lib/partner-service";

export async function GET() {
  const auth = await requirePartnerApi();
  if ("error" in auth) return auth.error;

  const earnings = await listPartnerEarnings(auth.partner.id);
  return NextResponse.json({ success: true, data: { earnings } });
}
