import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listPartnerApplications } from "@/lib/partner-service";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const applications = await listPartnerApplications();

    return NextResponse.json({ success: true, data: { applications } });
  } catch (error) {
    console.error("ADMIN_PARTNER_APPLICATIONS_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Başvurular yüklenemedi." },
      { status: 500 }
    );
  }
}
