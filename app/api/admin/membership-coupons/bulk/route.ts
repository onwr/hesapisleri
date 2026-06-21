import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError, createBulkCoupons } from "@/lib/admin/promotions";

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const result = await createBulkCoupons(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: `${result.count} kupon oluşturuldu.`,
      data: { count: result.count, batchId: result.batchId },
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Toplu kupon oluşturulamadı." },
      { status: 500 }
    );
  }
}
