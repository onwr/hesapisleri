import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions";
import { normalizeCouponCode } from "@/lib/admin/promotions/coupon-utils";
import { previewCouponPrice } from "@/lib/admin/coupons/admin-coupon-preview-service";

const legacyPreviewSchema = z
  .object({
    companyId: z.string().min(1),
    planId: z.string().min(1),
    billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
    couponCode: z.string().min(1),
    isRenewal: z.boolean().optional(),
  })
  .strict();

/** Legacy global preview by coupon code (pre-create flows). */
export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const parsed = legacyPreviewSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz önizleme isteği." },
        { status: 400 }
      );
    }

    const code = normalizeCouponCode(parsed.data.couponCode);
    const coupon = await db.membershipCoupon.findUnique({ where: { code } });
    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "Kupon bulunamadı." },
        { status: 404 }
      );
    }

    const preview = await previewCouponPrice(coupon.id, {
      companyId: parsed.data.companyId,
      planId: parsed.data.planId,
      billingInterval: parsed.data.billingInterval,
      isRenewal: parsed.data.isRenewal,
    });

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    if (error instanceof PromotionError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, message: "Fiyat önizlemesi yapılamadı." },
      { status: 500 }
    );
  }
}
