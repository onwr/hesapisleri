import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError, createCoupon, getCouponSummary, listCoupons } from "@/lib/admin/promotions";
import { parseCouponApiFilters } from "@/lib/admin/coupons/admin-coupon-route-utils";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const filters = parseCouponApiFilters(new URL(req.url).searchParams);
    const [list, summary] = await Promise.all([listCoupons(filters), getCouponSummary()]);

    return NextResponse.json({ success: true, data: { ...list, summary } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Kuponlar yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const coupon = await createCoupon(auth.user.id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Kupon taslak olarak oluşturuldu.",
      data: coupon,
    });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Kupon oluşturulamadı." },
      { status: 500 }
    );
  }
}
