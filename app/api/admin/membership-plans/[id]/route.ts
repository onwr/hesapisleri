import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { AdminPlanPatchValidationError } from "@/lib/admin/plans/admin-plan-schemas";
import {
  AdminPlanServiceError,
  patchAdminPlanMetadata,
} from "@/lib/admin/plans/admin-plan-patch-service";
import { db } from "@/lib/prisma";

const DEPRECATION = "299 - use /api/admin/plans/[id]";

type RouteContext = { params: Promise<{ id: string }> };

const deprecationHeaders = { Deprecation: DEPRECATION };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const plan = await db.membershipPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json(
        { success: false, message: "Plan bulunamadı." },
        { status: 404, headers: deprecationHeaders }
      );
    }

    return NextResponse.json(
      { success: true, data: { plan } },
      { headers: deprecationHeaders }
    );
  } catch (err) {
    console.error("[GET /api/admin/membership-plans/[id]]", err);
    return NextResponse.json({ success: false, message: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { id } = await context.params;
    const plan = await patchAdminPlanMetadata(id, body);

    return NextResponse.json(
      { success: true, message: "Plan güncellendi.", data: { plan } },
      { headers: deprecationHeaders }
    );
  } catch (error) {
    if (error instanceof AdminPlanPatchValidationError) {
      return NextResponse.json(
        { success: false, message: error.message, field: error.field },
        { status: error.status, headers: deprecationHeaders }
      );
    }
    if (error instanceof AdminPlanServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status, headers: deprecationHeaders }
      );
    }

    console.error("[PATCH /api/admin/membership-plans/[id]]", error);
    return NextResponse.json(
      { success: false, message: "Plan güncellenemedi." },
      { status: 500 }
    );
  }
}
