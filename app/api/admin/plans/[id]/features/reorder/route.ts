import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { reorderAdminPlanFeatures } from "@/lib/admin/plans/admin-plan-feature-service";
import {
  adminPlanFeatureReorderSchema,
  AdminPlanFeatureServiceError,
} from "@/lib/admin/plans/admin-plan-feature-schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanFeatureReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz sıralama.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const data = await reorderAdminPlanFeatures({
      planId: id,
      orderedFeatureIds: parsed.data.orderedFeatureIds,
      adminUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, message: "Sıralama güncellendi.", data });
  } catch (error) {
    if (error instanceof AdminPlanFeatureServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[PUT /api/admin/plans/[id]/features/reorder]", error);
    return NextResponse.json({ success: false, message: "Sıralama başarısız." }, { status: 500 });
  }
}
