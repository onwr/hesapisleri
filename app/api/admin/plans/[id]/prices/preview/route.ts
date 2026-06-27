import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanPricePreviewInputSchema } from "@/lib/admin/plans/admin-plan-schemas";
import {
  createAdminPlanPricePreview,
  PreviewSecretNotConfiguredError,
} from "@/lib/admin/plans/admin-plan-price-preview-service";
import { MembershipPlanPriceError } from "@/lib/membership-plan-price-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { PlanPriceOverlapError } from "@/lib/admin/plans/admin-plan-price-overlap";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanPricePreviewInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const preview = await createAdminPlanPricePreview(id, parsed.data);

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    if (error instanceof PreviewSecretNotConfiguredError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: 503 }
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
    console.error("[POST /api/admin/plans/[id]/prices/preview]", error);
    return NextResponse.json({ success: false, message: "Önizleme oluşturulamadı." }, { status: 500 });
  }
}
