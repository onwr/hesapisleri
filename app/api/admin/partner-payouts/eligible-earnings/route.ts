import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  listEligiblePayoutEarnings,
  parseEligibleEarningFilters,
} from "@/lib/admin/partner-payouts";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const filters = parseEligibleEarningFilters(
      Object.fromEntries(url.searchParams.entries())
    );

    if (!filters) {
      return NextResponse.json(
        { success: false, message: "Partner seçimi zorunludur." },
        { status: 400 }
      );
    }

    const earnings = await listEligiblePayoutEarnings(filters);

    return NextResponse.json({ success: true, data: { earnings } });
  } catch {
    return NextResponse.json(
      { success: false, message: "Uygun hak edişler yüklenemedi." },
      { status: 500 }
    );
  }
}
