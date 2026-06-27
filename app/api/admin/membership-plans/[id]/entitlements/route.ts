import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { getAdminPlanEntitlementsView } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";
import { EntitlementValidationError } from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { upsertPlanEntitlements } from "@/lib/admin/entitlements/plan-entitlement-service";

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
    console.error("PLAN_ENTITLEMENTS_GET_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Entitlement listesi yüklenemedi." },
      { status: 500 }
    );
  }
}

/** @deprecated /api/admin/plans/[id]/entitlements/preview + publish kullanın */
export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const saved = await upsertPlanEntitlements({
      planId: id,
      entitlements: body.entitlements ?? [],
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Entitlement kaydedildi.",
      data: saved,
    });
  } catch (error) {
    if (error instanceof EntitlementValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, issues: error.issues },
        { status: 400 }
      );
    }
    console.error("PLAN_ENTITLEMENTS_PUT_ERROR", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Kaydedilemedi." },
      { status: 400 }
    );
  }
}
