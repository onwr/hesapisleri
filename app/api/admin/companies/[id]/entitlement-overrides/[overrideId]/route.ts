import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { removeCompanyEntitlementOverride } from "@/lib/admin/entitlements/plan-entitlement-service";

type RouteContext = { params: Promise<{ id: string; overrideId: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: companyId, overrideId } = await context.params;
    const updated = await removeCompanyEntitlementOverride({
      companyId,
      overrideId,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Override kaldırıldı.",
      data: updated,
    });
  } catch (error) {
    console.error("COMPANY_OVERRIDE_DELETE_ERROR", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Silinemedi." },
      { status: 400 }
    );
  }
}
