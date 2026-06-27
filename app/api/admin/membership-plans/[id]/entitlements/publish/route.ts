import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { publishPlanEntitlementChanges } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";
import { EntitlementPreviewStaleError, EntitlementValidationError } from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { adminPlanEntitlementPublishSchema } from "@/lib/admin/plans/admin-plan-schemas";

type RouteContext = { params: Promise<{ id: string }> };

/** Legacy wrapper — canonical publish servisini çağırır. */
export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanEntitlementPublishSchema.safeParse({
      entitlements: body.entitlements ?? [],
      baseVersion: body.baseVersion ?? 0,
      reason: body.reason ?? "Legacy publish",
      changePolicy: body.changePolicy,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz yayın isteği.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const version = await publishPlanEntitlementChanges({
      planId: id,
      ...parsed.data,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Entitlement yayınlandı.",
      data: version,
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
    console.error("PLAN_ENTITLEMENTS_PUBLISH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Yayınlanamadı." },
      { status: 500 }
    );
  }
}
