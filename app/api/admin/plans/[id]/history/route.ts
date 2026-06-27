import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanHistoryQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanHistoryTab } from "@/lib/admin/plans/admin-plan-history-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const query = adminPlanHistoryQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    const data = await getAdminPlanHistoryTab(id, query);
    if (!data) {
      return NextResponse.json({ success: false, message: "Plan bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/history]", error);
    return NextResponse.json({ success: false, message: "Geçmiş yüklenemedi." }, { status: 500 });
  }
}
