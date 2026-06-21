import { NextResponse } from "next/server";
import { requirePartnerApi } from "@/lib/partner-auth";
import { listPartnerConversions } from "@/lib/partner-service";

export async function GET() {
  const auth = await requirePartnerApi();
  if ("error" in auth) return auth.error;

  const conversions = await listPartnerConversions(auth.partner.id);
  return NextResponse.json({ success: true, data: { conversions } });
}
