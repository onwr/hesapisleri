import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { z } from "zod";
import { cancelScheduledAdminPlanPrice } from "@/lib/admin/plans/admin-plan-price-publish-service";
import { MembershipPlanPriceError } from "@/lib/membership-plan-price-service";
import { invalidateAdminPlanCaches } from "@/lib/admin/plans/admin-plan-cache";

const cancelSchema = z.object({
  reason: z.string().min(1).max(2000),
});

type RouteContext = { params: Promise<{ id: string; priceId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "İptal sebebi gerekli.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, priceId } = await context.params;
    const price = await cancelScheduledAdminPlanPrice({
      planId: id,
      priceId,
      userId: auth.user.id,
      reason: parsed.data.reason,
    });

    invalidateAdminPlanCaches(id);

    return NextResponse.json({
      success: true,
      message: "Planlanmış fiyat iptal edildi.",
      data: { price },
    });
  } catch (error) {
    if (error instanceof MembershipPlanPriceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("[POST /api/admin/plans/[id]/prices/[priceId]/cancel]", error);
    return NextResponse.json({ success: false, message: "İptal işlemi başarısız." }, { status: 500 });
  }
}
