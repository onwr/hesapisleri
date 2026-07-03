import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanDeactivateSchema } from "@/lib/admin/plans/admin-plan-schemas";
import { deactivateAdminPlan } from "@/lib/admin/plans/admin-plan-action-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanDeactivateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Onay ve sebep gerekli.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const plan = await deactivateAdminPlan({
      planId: id,
      userId: auth.user.id,
      reason: parsed.data.reason,
    });

    return NextResponse.json({ success: true, message: "Plan pasifleştirildi.", data: { plan } });
  } catch (error) {
    if (error instanceof AdminPlanServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[POST /api/admin/plans/[id]/deactivate]", error);
    return NextResponse.json({ success: false, message: "Pasifleştirme başarısız." }, { status: 500 });
  }
}
