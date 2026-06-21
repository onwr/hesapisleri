import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listAdminPartners } from "@/lib/partner-service";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const partners = await listAdminPartners();

    return NextResponse.json({ success: true, data: { partners } });
  } catch (error) {
    console.error("ADMIN_PARTNERS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Partnerler yüklenemedi." },
      { status: 500 }
    );
  }
}
