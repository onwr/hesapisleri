import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  createAdminPlanFeature,
  getAdminPlanFeaturesTabData,
} from "@/lib/admin/plans/admin-plan-feature-service";
import {
  adminPlanFeatureCreateSchema,
  AdminPlanFeatureServiceError,
  AdminPlanFeatureValidationError,
} from "@/lib/admin/plans/admin-plan-feature-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const data = await getAdminPlanFeaturesTabData(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/plans/[id]/features]", error);
    return NextResponse.json(
      { success: false, message: "Özellik listesi yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanFeatureCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const feature = await createAdminPlanFeature({
      planId: id,
      adminUserId: auth.user.id,
      data: parsed.data,
    });

    return NextResponse.json({ success: true, message: "Özellik oluşturuldu.", data: feature });
  } catch (error) {
    if (error instanceof AdminPlanFeatureServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    if (error instanceof AdminPlanFeatureValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    console.error("[POST /api/admin/plans/[id]/features]", error);
    return NextResponse.json({ success: false, message: "Oluşturulamadı." }, { status: 500 });
  }
}
