import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminOverview } from "@/lib/admin-service";

export async function GET() {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const data = await getAdminOverview();

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_OVERVIEW_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Platform özeti yüklenemedi." },
      { status: 500 }
    );
  }
}
