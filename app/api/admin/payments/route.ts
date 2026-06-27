import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPaymentListQuerySchema } from "@/lib/admin/payments/admin-payment-schemas";
import { getAdminPaymentList } from "@/lib/admin/payments/admin-payment-list-service";
import { getAdminPaymentMetrics } from "@/lib/admin/payments/admin-payment-metric-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const flat = Object.fromEntries(searchParams.entries());
    const query = adminPaymentListQuerySchema.parse(flat);

    const [list, metrics] = await Promise.all([
      getAdminPaymentList(query),
      getAdminPaymentMetrics(),
    ]);

    return NextResponse.json({ success: true, data: { list, metrics, query } });
  } catch (err) {
    console.error("[GET /api/admin/payments]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}
