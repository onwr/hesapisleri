import "server-only";

import { db } from "@/lib/prisma";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { ACTIVE_SUB_STATUSES } from "@/lib/admin/plans/admin-plan-issue-service";
import { getAdminPlanDetail } from "@/lib/admin/plans/admin-plan-detail-service";
import { hasBlockingIssuesForActivate } from "@/lib/admin/plans/admin-plan-detail-issue-service";
import { invalidateAdminPlanCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

export async function activateAdminPlan(input: {
  planId: string;
  userId: string;
  reason: string;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);
  if (plan.planStatus === "ARCHIVED") {
    throw new AdminPlanServiceError("Arşivlenmiş plan yeniden etkinleştirilemez.", 400);
  }
  if (plan.planStatus === "ACTIVE" && plan.isActive) {
    throw new AdminPlanServiceError("Plan zaten aktif.", 400);
  }

  const detail = await getAdminPlanDetail(input.planId, "overview");
  if (!detail) throw new AdminPlanServiceError("Plan bulunamadı.", 404);

  if (hasBlockingIssuesForActivate(
    (detail.tabData as { issues: import("@/lib/admin/plans/admin-plan-detail-issue-service").PlanDetailIssue[] })?.issues ?? []
  )) {
    throw new AdminPlanServiceError(
      "Engelleyici plan sorunları var. Önce fiyat ve çakışma sorunlarını giderin.",
      409
    );
  }

  const pricingClass = detail.header.pricingClass;
  if (pricingClass === "UNCONFIGURED") {
    throw new AdminPlanServiceError(
      "Aktifleştirmek için en az bir satın alınabilir fiyat gerekir.",
      409
    );
  }

  if (plan.code) {
    const dup = await db.membershipPlan.findFirst({
      where: {
        code: plan.code,
        id: { not: input.planId },
        planStatus: "ACTIVE",
        isActive: true,
      },
    });
    if (dup) {
      throw new AdminPlanServiceError("Aynı kodla başka aktif plan var.", 409);
    }
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipPlan.update({
      where: { id: input.planId },
      data: {
        planStatus: "ACTIVE",
        isActive: true,
        publishedAt: now,
        archivedAt: null,
      },
    });

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_ACTIVATED",
      planId: input.planId,
      entityType: "MembershipPlan",
      entityId: input.planId,
      displayMessage: `${plan.name} aktifleştirildi.`,
      metadata: { reason: input.reason },
      tx,
    });

    return row;
  });

  invalidateAdminPlanCaches(input.planId);
  return updated;
}

export async function archiveAdminPlan(input: {
  planId: string;
  userId: string;
  reason: string;
  confirmActiveSubscriptions?: boolean;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);
  if (plan.planStatus === "ARCHIVED") {
    throw new AdminPlanServiceError("Plan zaten arşivlenmiş.", 400);
  }

  const activeSubCount = await db.companySubscription.count({
    where: { planId: input.planId, status: { in: [...ACTIVE_SUB_STATUSES] } },
  });

  if (activeSubCount > 0 && !input.confirmActiveSubscriptions) {
    throw new AdminPlanServiceError(
      `${activeSubCount} aktif abonelik var. Arşivlemek için confirmActiveSubscriptions=true gönderin.`,
      409
    );
  }

  const pendingTargetCount = await db.subscriptionPendingChange.count({
    where: {
      status: "PENDING",
      targetPlanId: input.planId,
    },
  });
  if (pendingTargetCount > 0) {
    throw new AdminPlanServiceError(
      "Bu plan bekleyen plan değişikliği hedefi. Önce pending change iptal edilmeli.",
      409
    );
  }

  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.membershipPlan.update({
      where: { id: input.planId },
      data: {
        planStatus: "ARCHIVED",
        isActive: false,
        archivedAt: now,
        visibility: plan.visibility === "PUBLIC" ? "PRIVATE" : plan.visibility,
      },
    });

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_ARCHIVED",
      planId: input.planId,
      entityType: "MembershipPlan",
      entityId: input.planId,
      displayMessage: `${plan.name} arşivlendi.`,
      metadata: { reason: input.reason, activeSubscriptionCount: activeSubCount },
      tx,
    });

    return { plan: updated, activeSubscriptionCount: activeSubCount };
  });

  invalidateAdminPlanCaches(input.planId);
  return result;
}

export async function deactivateAdminPlan(input: {
  planId: string;
  userId: string;
  reason: string;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);
  if (plan.planStatus === "ARCHIVED") {
    throw new AdminPlanServiceError("Arşivlenmiş plan pasifleştirilemez.", 400);
  }
  if (plan.planStatus !== "ACTIVE" || !plan.isActive) {
    throw new AdminPlanServiceError("Yalnızca satışta aktif planlar pasifleştirilebilir.", 400);
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipPlan.update({
      where: { id: input.planId },
      data: {
        isActive: false,
        visibility: plan.visibility === "PUBLIC" ? "PRIVATE" : plan.visibility,
      },
    });

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_DEACTIVATED",
      planId: input.planId,
      entityType: "MembershipPlan",
      entityId: input.planId,
      displayMessage: `${plan.name} pasifleştirildi.`,
      metadata: { reason: input.reason },
      tx,
    });

    return row;
  });

  invalidateAdminPlanCaches(input.planId);
  return updated;
}
