import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanPricePatchSchema } from "@/lib/admin/plans/admin-plan-schemas";
import {
  MembershipPlanPriceError,
  serializePlanPriceForAdmin,
  updatePlanPriceDraft,
} from "@/lib/membership-plan-price-service";
import { PlanPriceOverlapError } from "@/lib/admin/plans/admin-plan-price-overlap";

type RouteContext = { params: Promise<{ id: string; priceId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanPricePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Geçersiz fiyat güncellemesi.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { id, priceId } = await context.params;
    const price = await updatePlanPriceDraft({
      planId: id,
      priceId,
      userId: auth.user.id,
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: "Fiyat güncellendi.",
      data: { price: serializePlanPriceForAdmin(price) },
    });
  } catch (error) {
    if (error instanceof PlanPriceOverlapError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 });
    }
    if (error instanceof MembershipPlanPriceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("[PATCH /api/admin/plans/[id]/prices/[priceId]]", error);
    return NextResponse.json(
      { success: false, message: "Fiyat güncellenemedi." },
      { status: 500 }
    );
  }
}
