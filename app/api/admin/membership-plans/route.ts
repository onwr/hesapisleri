import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanListQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanList } from "@/lib/admin/plans/admin-plan-list-service";
import { getAdminPlanMetrics } from "@/lib/admin/plans/admin-plan-metric-service";

const DEPRECATION = "299 - use /api/admin/plans";

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

    return NextResponse.json(
      { success: true, data: { list, metrics, query } },
      {
        headers: {
          Deprecation: DEPRECATION,
          Link: '</api/admin/plans>; rel="successor-version"',
        },
      }
    );
  } catch (err) {
    console.error("[GET /api/admin/membership-plans]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
