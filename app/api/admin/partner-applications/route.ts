import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  getPartnerApplicationSummary,
  listPartnerApplicationsAdmin,
  parseApplicationListFilters,
} from "@/lib/admin/partner-applications";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const filters = parseApplicationListFilters(
      Object.fromEntries(url.searchParams.entries())
    );

    const [summary, list] = await Promise.all([
      getPartnerApplicationSummary(),
      listPartnerApplicationsAdmin(filters),
    ]);

    return NextResponse.json({
      success: true,
      data: { summary, ...list },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Başvurular yüklenemedi." },
      { status: 500 }
    );
  }
}
