import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  calculateMrrWithDuplicateAwareness,
  MRR_POLICY_DESCRIPTION,
} from "@/lib/admin/subscriptions/admin-subscription-action-validators";
import { ACTIVE_SUB_STATUSES } from "@/lib/admin/plans/admin-plan-issue-service";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import { findPriceResolutionConflicts } from "@/lib/admin/plans/admin-plan-price-resolution-utils";

/** Sistem şu an plan başına tek checkout currency (defaultCurrency) destekliyor. */
export const PLAN_SUPPORTS_MULTI_CURRENCY = false;

export async function getAdminPlanMetrics() {
  const [plans, subs, prices] = await Promise.all([
    db.membershipPlan.findMany({
      select: {
        id: true,
        planStatus: true,
        isActive: true,
        defaultCurrency: true,
        visibility: true,
        code: true,
      },
    }),
    db.companySubscription.findMany({
      where: { status: { in: [...ACTIVE_SUB_STATUSES] } },
      select: {
        id: true,
        companyId: true,
        status: true,
        lockedPlanPrice: {
          select: { currency: true, monthlyEquivalentMinor: true },
        },
      },
    }),
    db.membershipPlanPrice.findMany({
      where: { status: { in: ["ACTIVE", "SCHEDULED"] } },
      select: {
        planId: true,
        billingInterval: true,
        currency: true,
        salePriceMinor: true,
        status: true,
        isPublic: true,
        effectiveFrom: true,
        effectiveUntil: true,
      },
    }),
  ]);

  const pricesByPlan = new Map<string, typeof prices>();
  for (const p of prices) {
    const list = pricesByPlan.get(p.planId) ?? [];
    list.push(p);
    pricesByPlan.set(p.planId, list);
  }

  const statusCounts = { DRAFT: 0, ACTIVE: 0, ARCHIVED: 0 };
  let checkoutAvailableCount = 0;

  for (const plan of plans) {
    statusCounts[plan.planStatus]++;
    const planPrices = pricesByPlan.get(plan.id) ?? [];
    const pricingClass = classifyPlanPricing(planPrices);
    const conflicts = findPriceResolutionConflicts(planPrices);
    if (
      isPlanCheckoutAvailable({
        planStatus: plan.planStatus,
        visibility: plan.visibility,
        code: plan.code,
        pricingClass,
        hasPriceConflicts: conflicts.length > 0,
      })
    ) {
      checkoutAvailableCount++;
    }
  }

  const mrrSubs = subs.filter(
    (s) => s.status === "ACTIVE" || s.status === "CANCEL_AT_PERIOD_END"
  );
  const mrrAnalysis = calculateMrrWithDuplicateAwareness(
    mrrSubs.map((s) => ({
      companyId: s.companyId,
      subscriptionId: s.id,
      lockedPlanPrice: s.lockedPlanPrice,
    }))
  );

  const mrrMajor: Record<string, number> = {};
  for (const [cur, v] of Object.entries(mrrAnalysis.mrrMinor)) {
    mrrMajor[cur] = v / 100;
  }

  return {
    totalPlans: plans.length,
    statusCounts,
    checkoutAvailableCount,
    activeSubscriptionCount: subs.length,
    mrr: mrrMajor,
    mrrPolicy: MRR_POLICY_DESCRIPTION,
    duplicateActiveCompanyCount: mrrAnalysis.duplicateCompanies.length,
  };
}

export async function getPlanMrrByPlanId(planIds: string[]) {
  const subs = await db.companySubscription.findMany({
    where: {
      planId: { in: planIds },
      status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] },
    },
    select: {
      planId: true,
      companyId: true,
      lockedPlanPrice: {
        select: { currency: true, monthlyEquivalentMinor: true },
      },
    },
  });

  const byPlan = new Map<string, Record<string, number>>();
  for (const sub of subs) {
    if (!sub.planId) continue;
    const price = sub.lockedPlanPrice;
    if (!price || (price.monthlyEquivalentMinor ?? 0) <= 0) continue;
    const cur = price.currency;
    const map = byPlan.get(sub.planId) ?? {};
    map[cur] = (map[cur] ?? 0) + (price.monthlyEquivalentMinor ?? 0);
    byPlan.set(sub.planId, map);
  }

  const result = new Map<string, Record<string, number>>();
  for (const [planId, minorMap] of byPlan) {
    const major: Record<string, number> = {};
    for (const [cur, v] of Object.entries(minorMap)) {
      major[cur] = v / 100;
    }
    result.set(planId, major);
  }
  return result;
}
