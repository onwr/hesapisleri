import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { PromotionError, previewPromotionPrice } from "@/lib/admin/promotions";

const schema = z.object({
  companyId: z.string().min(1),
  planId: z.string().min(1),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  couponCode: z.string().min(1),
  isRenewal: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz önizleme isteği." },
        { status: 400 }
      );
    }

    const preview = await previewPromotionPrice(parsed.data);

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
