import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPaymentListQuerySchema } from "@/lib/admin/payments/admin-payment-schemas";
import { exportAdminPaymentsCsv } from "@/lib/admin/payments/admin-payment-list-service";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const flat = Object.fromEntries(searchParams.entries());
    const query = adminPaymentListQuerySchema.parse(flat);
    const csv = await exportAdminPaymentsCsv(query);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="admin-payments.csv"',
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/payments/export]", err);
    return NextResponse.json({ success: false, message: "Export başarısız" }, { status: 500 });
  }
}
