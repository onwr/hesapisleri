import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError } from "@/lib/admin/promotions";
import { issueBulkExportToken } from "@/lib/admin/promotions/coupon-bulk-service";

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const batchId = body.batchId as string;
    if (!batchId) {
      return NextResponse.json(
        { success: false, message: "batchId gerekli." },
        { status: 400 }
      );
    }

    const result = await issueBulkExportToken(batchId, auth.user.id);
    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: `/api/admin/membership-coupons/bulk/${batchId}/export?token=${result.token}`,
        expiresAt: result.expiresAt,
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
      { success: false, message: "Export token oluşturulamadı." },
      { status: 500 }
    );
  }
}
