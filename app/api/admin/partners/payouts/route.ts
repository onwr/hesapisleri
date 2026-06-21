import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listAdminPayouts } from "@/lib/partner-service";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const payouts = await listAdminPayouts();

    return NextResponse.json({ success: true, data: { payouts } });
  } catch (error) {
    console.error("ADMIN_PARTNER_PAYOUTS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Ödemeler yüklenemedi." },
      { status: 500 }
    );
  }
}
