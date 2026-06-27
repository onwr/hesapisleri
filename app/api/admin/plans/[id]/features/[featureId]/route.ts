import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  softDeleteAdminPlanFeature,
  updateAdminPlanFeature,
} from "@/lib/admin/plans/admin-plan-feature-service";
import {
  adminPlanFeatureUpdateSchema,
  AdminPlanFeatureServiceError,
  AdminPlanFeatureValidationError,
} from "@/lib/admin/plans/admin-plan-feature-schemas";

type RouteContext = { params: Promise<{ id: string; featureId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanFeatureUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, featureId } = await context.params;
    const feature = await updateAdminPlanFeature({
      planId: id,
      featureId,
      adminUserId: auth.user.id,
      data: parsed.data,
    });

    return NextResponse.json({ success: true, message: "Özellik güncellendi.", data: feature });
  } catch (error) {
    if (error instanceof AdminPlanFeatureServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof AdminPlanFeatureValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error("[PATCH /api/admin/plans/[id]/features/[featureId]]", error);
    return NextResponse.json({ success: false, message: "Güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id, featureId } = await context.params;
    await softDeleteAdminPlanFeature({
      planId: id,
      featureId,
      adminUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, message: "Özellik silindi." });
  } catch (error) {
    if (error instanceof AdminPlanFeatureServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/admin/plans/[id]/features/[featureId]]", error);
    return NextResponse.json({ success: false, message: "Silinemedi." }, { status: 500 });
  }
}
