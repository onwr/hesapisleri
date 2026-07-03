import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import {
  evaluatePlanDeleteEligibility,
  type PlanDeleteUsageCounts,
} from "@/lib/admin/plans/admin-plan-delete-eligibility";
import { invalidateAdminPlanCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

export type AdminPlanDeleteAssessment = {
  canHardDelete: boolean;
  reasons: string[];
  counts: PlanDeleteUsageCounts;
};

async function loadPlanDeleteUsageCounts(planId: string): Promise<PlanDeleteUsageCounts> {
  const [
    subscriptions,
    payments,
    priceLinkedSubscriptions,
    priceLinkedPayments,
    couponScopes,
    campaignScopes,
  ] = await Promise.all([
    db.companySubscription.count({ where: { planId } }),
    db.membershipPayment.count({ where: { planId } }),
    db.companySubscription.count({
      where: {
        OR: [{ lockedPlanPrice: { planId } }, { nextPlanPrice: { planId } }],
      },
    }),
    db.membershipPayment.count({
      where: { planPrice: { planId } },
    }),
    db.membershipCouponPlan.count({ where: { planId } }),
    db.membershipCampaignScope.count({ where: { planId } }),
  ]);

  return {
    subscriptions,
    payments,
    priceLinkedSubscriptions,
    priceLinkedPayments,
    couponScopes,
    campaignScopes,
  };
}

export async function assessAdminPlanDeleteEligibility(
  planId: string
): Promise<AdminPlanDeleteAssessment> {
  const counts = await loadPlanDeleteUsageCounts(planId);
  const { canHardDelete, reasons } = evaluatePlanDeleteEligibility(counts);
  return { canHardDelete, reasons, counts };
}

export async function deleteAdminPlan(input: {
  planId: string;
  userId: string;
  confirmName: string;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);

  if (plan.name.trim() !== input.confirmName.trim()) {
    throw new AdminPlanServiceError("Onay için plan adı eşleşmiyor.", 400);
  }

  const assessment = await assessAdminPlanDeleteEligibility(input.planId);
  if (!assessment.canHardDelete) {
    throw new AdminPlanServiceError(
      "Bu plan daha önce kullanıldığı için silinemez. Planı arşivleyebilirsiniz.",
      409
    );
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.adminPlanNote.updateMany({
        where: { planId: input.planId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      await tx.membershipPlan.delete({ where: { id: input.planId } });

      await logAdminPlanAudit({
        userId: input.userId,
        action: "PLAN_DELETED",
        planId: input.planId,
        entityType: "MembershipPlan",
        entityId: input.planId,
        displayMessage: `${plan.name} kalıcı olarak silindi.`,
        metadata: { code: plan.code },
        tx,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      throw new AdminPlanServiceError(
        "Bu plan kullanımda olduğu için silinemez.",
        409
      );
    }
    throw err;
  }

  invalidateAdminPlanCaches(input.planId);
  return { deleted: true, planId: input.planId };
}
