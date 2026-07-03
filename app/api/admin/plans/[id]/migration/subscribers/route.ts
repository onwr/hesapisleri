import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listArchivedPlanSubscribers } from "@/lib/admin/plans/admin-plan-migration-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;

    const subscribers = await listArchivedPlanSubscribers(id, { search });

    return NextResponse.json({ success: true, data: subscribers });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/migration/subscribers]", error);
    return NextResponse.json(
      { success: false, message: "Abone listesi yüklenemedi." },
      { status: 500 }
    );
  }
}
