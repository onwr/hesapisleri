import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError } from "@/lib/admin/promotions";
import { exportBulkCouponCsv } from "@/lib/admin/promotions/coupon-bulk-service";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { batchId } = await context.params;
    const token = new URL(req.url).searchParams.get("token");
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token gerekli." },
        { status: 400 }
      );
    }

    const csv = await exportBulkCouponCsv(batchId, token);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="coupon-batch-${batchId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "CSV export başarısız." },
      { status: 500 }
    );
  }
}
