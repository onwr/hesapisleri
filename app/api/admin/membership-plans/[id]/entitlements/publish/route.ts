import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { publishPlanEntitlements } from "@/lib/admin/entitlements/plan-entitlement-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const version = await publishPlanEntitlements({
      planId: id,
      changePolicy: body.changePolicy,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Entitlement yayınlandı.",
      data: version,
    });
  } catch (error) {
    console.error("PLAN_ENTITLEMENTS_PUBLISH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Yayınlanamadı." },
      { status: 500 }
    );
  }
}
