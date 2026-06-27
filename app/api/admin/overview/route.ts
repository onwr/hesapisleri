import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getCachedAdminOverview } from "@/lib/admin/admin-overview-cache";

export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);

    const data = await getCachedAdminOverview({
      range: searchParams.get("range"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      timezone: searchParams.get("timezone"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_OVERVIEW_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Platform özeti yüklenemedi." },
      { status: 500 }
    );
  }
}
