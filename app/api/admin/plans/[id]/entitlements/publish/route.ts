import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanEntitlementPublishSchema } from "@/lib/admin/plans/admin-plan-schemas";
import { publishPlanEntitlementChanges } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";
import { EntitlementPreviewStaleError, EntitlementValidationError } from "@/lib/admin/entitlements/admin-plan-entitlement-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanEntitlementPublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz yayın isteği.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const result = await publishPlanEntitlementChanges({
      planId: id,
      entitlements: parsed.data.entitlements,
      baseVersion: parsed.data.baseVersion,
      reason: parsed.data.reason,
      changePolicy: parsed.data.changePolicy,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Entitlement yayınlandı.",
      data: result,
    });
  } catch (error) {
    if (error instanceof EntitlementPreviewStaleError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof EntitlementValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, issues: error.issues },
        { status: 400 }
      );
    }
    console.error("[PUT /api/admin/plans/[id]/entitlements/publish]", error);
    return NextResponse.json({ success: false, message: "Yayınlanamadı." }, { status: 500 });
  }
}
