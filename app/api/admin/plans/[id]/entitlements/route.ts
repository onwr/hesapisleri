import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminPlanEntitlementsView } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminPlanEntitlementsView(id);
    if (!data) {
      return NextResponse.json({ success: false, message: "Plan bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/entitlements]", error);
    return NextResponse.json(
      { success: false, message: "Entitlement listesi yüklenemedi." },
      { status: 500 }
    );
  }
}
