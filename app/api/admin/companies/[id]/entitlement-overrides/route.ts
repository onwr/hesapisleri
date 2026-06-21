import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { createCompanyEntitlementOverride } from "@/lib/admin/entitlements/plan-entitlement-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: companyId } = await context.params;
    const body = await req.json();
    const override = await createCompanyEntitlementOverride({
      companyId,
      ...body,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Özel hak tanımlandı.",
      data: override,
    });
  } catch (error) {
    console.error("COMPANY_OVERRIDE_CREATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Oluşturulamadı." },
      { status: 400 }
    );
  }
}
