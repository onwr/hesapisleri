import { NextResponse } from "next/server";
import { requirePartnerApi } from "@/lib/partner-auth";
import {
  PartnerServiceError,
  getPartnerDashboardStats,
} from "@/lib/partner-service";

export async function GET() {
  try {
    const auth = await requirePartnerApi();
    if ("error" in auth) return auth.error;

    const data = await getPartnerDashboardStats(auth.partner.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("PARTNER_STATS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "İstatistikler yüklenemedi." },
      { status: 500 }
    );
  }
}
