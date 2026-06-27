import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError, getCouponDetail, updateCoupon } from "@/lib/admin/promotions";

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

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ success: false, message: "Kupon yüklenemedi." }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const coupon = await updateCoupon(auth.user.id, id, await req.json());

    return NextResponse.json({
      success: true,
      message: "Kupon güncellendi.",
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
      { success: false, message: "Kupon güncellenemedi." },
      { status: 500 }
    );
  }
}
