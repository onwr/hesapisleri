import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  MembershipPlanPriceError,
  publishPlanPrice,
  serializePlanPriceForAdmin,
} from "@/lib/membership-plan-price-service";

type RouteContext = { params: Promise<{ id: string; priceId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { priceId } = await context.params;
    const price = await publishPlanPrice({
      priceId,
      userId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: "Fiyat yayınlandı.",
      data: { price: serializePlanPriceForAdmin(price) },
    });
  } catch (error) {
    if (error instanceof MembershipPlanPriceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("ADMIN_PLAN_PRICE_PUBLISH_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Fiyat yayınlanamadı." },
      { status: 500 }
    );
  }
}
