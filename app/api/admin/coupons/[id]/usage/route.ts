import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { listCouponUsage } from "@/lib/admin/promotions/coupon-query-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const data = await listCouponUsage(id, {
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 25),
      status: searchParams.get("status") ?? undefined,
      companyId: searchParams.get("companyId") ?? undefined,
    });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "Kullanım kayıtları yüklenemedi." },
      { status: 500 }
    );
  }
}
