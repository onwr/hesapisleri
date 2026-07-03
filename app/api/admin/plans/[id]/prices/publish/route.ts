import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { verifyApiMutationOrigin } from "@/lib/api-origin-guard";
import { adminPlanPricePublishSchema } from "@/lib/admin/plans/admin-plan-schemas";
import {
  publishAdminPlanPriceFromPreview,
  PreviewStaleError,
} from "@/lib/admin/plans/admin-plan-price-preview-service";
import { MembershipPlanPriceError } from "@/lib/membership-plan-price-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { PlanPriceOverlapError } from "@/lib/admin/plans/admin-plan-price-overlap";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const originError = verifyApiMutationOrigin(req);
    if (originError) return originError;

    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanPricePublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const price = await publishAdminPlanPriceFromPreview({
      planId: id,
      userId: auth.user.id,
      reason: parsed.data.reason,
      priceInput: parsed.data.price,
      expectedCurrentPriceId: parsed.data.expectedCurrentPriceId,
    });

    return NextResponse.json({
      success: true,
      message: "Fiyat yayınlandı.",
      data: { price },
    });
  } catch (error) {
    if (error instanceof PreviewStaleError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: 409 }
      );
    }
    if (error instanceof PlanPriceOverlapError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 409 });
    }
    if (error instanceof MembershipPlanPriceError || error instanceof AdminPlanServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("[POST /api/admin/plans/[id]/prices/publish]", error);
    return NextResponse.json({ success: false, message: "Yayınlama başarısız." }, { status: 500 });
  }
}
