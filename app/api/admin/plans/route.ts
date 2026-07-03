import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanListQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanList } from "@/lib/admin/plans/admin-plan-list-service";
import { getAdminPlanMetrics } from "@/lib/admin/plans/admin-plan-metric-service";
import {
  AdminPlanCreateError,
  createAdminPlanDraft,
} from "@/lib/admin/plans/admin-plan-create-service";
import {
  AdminPlanPatchValidationError,
} from "@/lib/admin/plans/admin-plan-schemas";
import { EntitlementValidationError } from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const flat = Object.fromEntries(searchParams.entries());
    const query = adminPlanListQuerySchema.parse(flat);

    const [list, metrics] = await Promise.all([
      getAdminPlanList(query),
      getAdminPlanMetrics(),
    ]);

    return NextResponse.json({ success: true, data: { list, metrics, query } });
  } catch (err) {
    console.error("[GET /api/admin/plans]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const plan = await createAdminPlanDraft(body, auth.user.id);

    return NextResponse.json(
      {
        success: true,
        message: plan.isActive ? "Plan oluşturuldu." : "Plan oluşturuldu (pasif).",
        data: { planId: plan.id, code: plan.code },
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
    if (error instanceof EntitlementValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, issues: error.issues },
        { status: error.status }
      );
    }
    if (error instanceof AdminPlanCreateError || error instanceof AdminPlanServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    console.error("[POST /api/admin/plans]", error);
    return NextResponse.json({ success: false, message: "Plan oluşturulamadı." }, { status: 500 });
  }
}
