import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { migrateSubscribersToPlan } from "@/lib/admin/plans/admin-plan-migration-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";

type RouteContext = { params: Promise<{ id: string }> };

const periodEnum = z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]);

const migrateBodySchema = z.object({
  targetPlanId: z.string().min(1),
  subscriptionIds: z.array(z.string().min(1)).min(1),
  timing: z.enum(["AT_RENEWAL", "IMMEDIATE"]),
  // partialRecord: yalnız kullanıcının eşlediği dönemler gönderilir, geri kalanı
  // undefined kalabilir — z.record ile tüm enum anahtarları zorunlu olurdu.
  periodMapping: z.partialRecord(periodEnum, periodEnum),
  confirmImmediate: z.boolean().optional(),
  // Kaynak dönemi çözülemeyen abonelikler (ör. legacy trial kayıtları,
  // billingInterval=null) için kullanıcının seçtiği hedef dönem.
  fallbackTargetPeriod: periodEnum.optional(),
});

export async function POST(req: Request, context: RouteContext) {
  try {
    const auth = await requireSuperAdminApi();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = migrateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Geçersiz istek.", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await migrateSubscribersToPlan({
      sourcePlanId: id,
      targetPlanId: parsed.data.targetPlanId,
      subscriptionIds: parsed.data.subscriptionIds,
      timing: parsed.data.timing,
      periodMapping: parsed.data.periodMapping,
      requestedByUserId: auth.user.id,
      confirmImmediate: parsed.data.confirmImmediate,
      fallbackTargetPeriod: parsed.data.fallbackTargetPeriod,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: result.summary.message,
    });
  } catch (error) {
    if (error instanceof AdminPlanServiceError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }
    console.error("[POST /api/admin/plans/[id]/migration/migrate]", error);
    return NextResponse.json(
      { success: false, message: "Taşıma işlemi başarısız." },
      { status: 500 }
    );
  }
}
