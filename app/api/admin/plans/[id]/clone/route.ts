import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPlanPatchValidationError,
} from "@/lib/admin/plans/admin-plan-schemas";
import {
  AdminPlanCloneError,
  cloneAdminPlan,
} from "@/lib/admin/plans/admin-plan-clone-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: sourcePlanId } = await context.params;
    const body = await req.json();
    const result = await cloneAdminPlan(sourcePlanId, body, auth.user.id);

    return NextResponse.json(
      {
        success: true,
        message: "Plan kopyalandı.",
        data: {
          planId: result.plan.id,
          code: result.plan.code,
          sourcePlanId: result.meta.sourcePlanId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AdminPlanPatchValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, field: error.field },
        { status: error.status }
      );
    }
    if (error instanceof AdminPlanCloneError || error instanceof AdminPlanServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[POST /api/admin/plans/[id]/clone]", error);
    return NextResponse.json({ success: false, message: "Plan kopyalanamadı." }, { status: 500 });
  }
}
