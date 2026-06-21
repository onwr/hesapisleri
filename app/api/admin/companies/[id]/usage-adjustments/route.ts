import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adjustCompanyUsage } from "@/lib/billing/usage/usage-mutation-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id: companyId } = await context.params;
    const body = await req.json();
    const updated = await adjustCompanyUsage({
      companyId,
      entitlementCode: body.entitlementCode,
      delta: body.delta,
      reason: body.reason ?? "Admin düzeltmesi",
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Kullanım güncellendi.",
      data: updated,
    });
  } catch (error) {
    console.error("COMPANY_USAGE_ADJUST_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Kullanım güncellenemedi." },
      { status: 500 }
    );
  }
}
