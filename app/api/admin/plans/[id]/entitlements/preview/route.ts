import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { adminPlanEntitlementPreviewSchema } from "@/lib/admin/plans/admin-plan-schemas";
import { previewPlanEntitlementChanges } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const parsed = adminPlanEntitlementPreviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz önizleme isteği.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const preview = await previewPlanEntitlementChanges({
      planId: id,
      entitlements: parsed.data.entitlements,
      baseVersion: parsed.data.baseVersion,
    });

    if (preview.stale) {
      return NextResponse.json(
        {
          success: false,
          code: "ENTITLEMENT_PREVIEW_STALE",
          message: "Entitlement sürümü değişti. Lütfen yeniden önizleyin.",
          data: preview,
        },
        { status: 409 }
      );
    }

    if (!preview.valid) {
      return NextResponse.json(
        {
          success: false,
          message: "Doğrulama hataları.",
          data: preview,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    console.error("[POST /api/admin/plans/[id]/entitlements/preview]", error);
    return NextResponse.json({ success: false, message: "Önizleme başarısız." }, { status: 500 });
  }
}
