import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listMigrationEligibleTargetPlans } from "@/lib/admin/plans/admin-plan-migration-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const targets = await listMigrationEligibleTargetPlans(id);

    return NextResponse.json({ success: true, data: targets });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/migration/targets]", error);
    return NextResponse.json(
      { success: false, message: "Hedef planlar yüklenemedi." },
      { status: 500 }
    );
  }
}
