import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  createCoupon,
  getCouponSummary,
  listCoupons,
} from "@/lib/admin/promotions";
import type { CouponListFilters } from "@/lib/admin/promotions";

export async function GET(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });

    const filters: CouponListFilters = {
      q: params.q,
      status: params.status as CouponListFilters["status"],
      discountType: params.discountType as CouponListFilters["discountType"],
      planId: params.planId,
      interval: params.interval as CouponListFilters["interval"],
      sort: (params.sort as CouponListFilters["sort"]) ?? "code",
      order: (params.order as CouponListFilters["order"]) ?? "asc",
      page: Math.max(1, Number(params.page ?? 1) || 1),
    };

    const [list, summary] = await Promise.all([
      listCoupons(filters),
      getCouponSummary(),
    ]);

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

    const body = await req.json();
    const coupon = await createCoupon(auth.user.id, body);

    return NextResponse.json({
      success: true,
      message: "Kupon oluşturuldu.",
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
