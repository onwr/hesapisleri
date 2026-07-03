import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import {
  AdminPlanPatchValidationError,
  adminPlanDeleteSchema,
  resolvePlanTab,
} from "@/lib/admin/plans/admin-plan-schemas";
import {
  AdminPlanServiceError,
  patchAdminPlanMetadata,
} from "@/lib/admin/plans/admin-plan-patch-service";
import { getAdminPlanDetail } from "@/lib/admin/plans/admin-plan-detail-service";
import { deleteAdminPlan } from "@/lib/admin/plans/admin-plan-delete-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const tab = resolvePlanTab(searchParams.get("tab") ?? undefined);
    const rawParams = Object.fromEntries(searchParams.entries());

    const detail = await getAdminPlanDetail(id, tab, rawParams);
    if (!detail) {
      return NextResponse.json({ success: false, message: "Plan bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (err) {
    console.error("[GET /api/admin/plans/[id]]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id } = await context.params;
    const plan = await patchAdminPlanMetadata(id, body, auth.user.id);

    return NextResponse.json({
      success: true,
      message: "Plan güncellendi.",
      data: { plan },
    });
  } catch (error) {
    if (error instanceof AdminPlanPatchValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, field: error.field },
        { status: error.status }
      );
    }
    if (error instanceof AdminPlanServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    console.error("[PATCH /api/admin/plans/[id]]", error);
    return NextResponse.json({ success: false, message: "Plan güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Silme onayı ve plan adı gerekli.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    await deleteAdminPlan({
      planId: id,
      userId: auth.user.id,
      confirmName: parsed.data.confirmName,
    });

    return NextResponse.json({ success: true, message: "Plan silindi." });
  } catch (error) {
    if (error instanceof AdminPlanServiceError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/admin/plans/[id]]", error);
    return NextResponse.json(
      { success: false, message: "Bu plan kullanımda olduğu için silinemez." },
      { status: 409 }
    );
  }
}
