import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  PromotionError,
  getCouponDetail,
  updateCouponTargeting,
} from "@/lib/admin/promotions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getCouponDetail(id);
    if (!data) {
      return NextResponse.json({ success: false, message: "Kupon bulunamadı." }, { status: 404 });
    }

    const { coupon } = data;
    return NextResponse.json({
      success: true,
      data: {
        planIds: coupon.planScopes.map((s) => s.planId),
        allowedIntervals: coupon.allowedIntervals,
        currency: coupon.currency,
        minimumAmountMinor: coupon.minimumAmountMinor,
        maxUsage: coupon.maxUsage,
        maxUsagePerCompany: coupon.maxUsagePerCompany,
        newCustomersOnly: coupon.newCustomersOnly,
        firstPaymentOnly: coupon.firstPaymentOnly,
        renewalAllowed: coupon.renewalAllowed,
        stackable: coupon.stackable,
        status: coupon.status,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Hedefleme yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const coupon = await updateCouponTargeting(auth.user.id, id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Kupon hedeflemesi güncellendi.",
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
      { success: false, message: "Hedefleme güncellenemedi." },
      { status: 500 }
    );
  }
}
