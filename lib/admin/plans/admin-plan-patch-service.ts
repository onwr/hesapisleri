import "server-only";

import { db } from "@/lib/prisma";
import { invalidateAdminPlanCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import {
  AdminPlanPatchValidationError,
  adminPlanMetadataPatchSchema,
  assertNoForbiddenPlanPatchKeys,
  type AdminPlanMetadataPatch,
} from "@/lib/admin/plans/admin-plan-schemas";

export class AdminPlanServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminPlanServiceError";
    this.status = status;
  }
}

export async function patchAdminPlanMetadata(
  planId: string,
  rawBody: unknown,
  actorUserId?: string | null
) {
  if (!rawBody || typeof rawBody !== "object") {
    throw new AdminPlanPatchValidationError("Geçersiz istek gövdesi.");
  }
  const body = rawBody as Record<string, unknown>;
  assertNoForbiddenPlanPatchKeys(body);

  const parsed = adminPlanMetadataPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminPlanPatchValidationError(
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }

  const input: AdminPlanMetadataPatch = parsed.data;
  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new AdminPlanServiceError("Plan bulunamadı.", 404);
  }

  if ((input.code || input.slug) && plan.planStatus !== "DRAFT") {
    throw new AdminPlanPatchValidationError(
      "Plan kodu/slug yalnızca DRAFT durumunda değiştirilebilir.",
      input.code ? "code" : "slug"
    );
  }

  if (input.code && input.code !== plan.code) {
    const existing = await db.membershipPlan.findUnique({ where: { code: input.code } });
    if (existing && existing.id !== planId) {
      throw new AdminPlanPatchValidationError("Bu plan kodu zaten kullanılıyor.", "code");
    }
  }

  if (input.slug && input.slug !== plan.slug) {
    const existing = await db.membershipPlan.findUnique({ where: { slug: input.slug } });
    if (existing && existing.id !== planId) {
      throw new AdminPlanPatchValidationError("Bu slug zaten kullanılıyor.", "slug");
    }
  }

  const updated = await db.membershipPlan.update({
    where: { id: planId },
    data: {
      name: input.name,
      description: input.description,
      shortDescription: input.shortDescription,
      badgeText: input.badgeText,
      sortOrder: input.sortOrder,
      trialEnabled: input.trialEnabled,
      trialDays: input.trialDays,
      autoRenewAllowed: input.autoRenewAllowed,
      upgradeAllowed: input.upgradeAllowed,
      downgradeAllowed: input.downgradeAllowed,
      cancellationAllowed: input.cancellationAllowed,
      gracePeriodDays: input.gracePeriodDays,
      isFeatured: input.isFeatured,
      code: input.code,
      slug: input.slug,
    },
  });

  if (actorUserId) {
    await logAdminPlanAudit({
      userId: actorUserId,
      action: "PLAN_UPDATED",
      planId,
      entityType: "MembershipPlan",
      entityId: planId,
      displayMessage: `Plan metadata güncellendi: ${updated.name}`,
      metadata: {
        fields: Object.keys(input),
      },
    });
  }

  invalidateAdminPlanCaches(planId);
  return updated;
}
