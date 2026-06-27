import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminPlanDetail } from "@/lib/admin/plans/admin-plan-detail-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const detail = await getAdminPlanDetail(id, "pricing");
    if (!detail) {
      return NextResponse.json({ success: false, message: "Plan bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail.tabData });
  } catch (err) {
    console.error("[GET /api/admin/plans/[id]/prices]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
