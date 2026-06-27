import { db } from "@/lib/prisma";
import {
  calculateMrrWithDuplicateAwareness,
  MRR_POLICY_DESCRIPTION,
} from "@/lib/admin/subscriptions/admin-subscription-action-validators";

export type SubscriptionMetrics = {
  total: number;
  active: number;
  trial: number;
  pastDue: number;
  cancelAtPeriodEnd: number;
  cancelled: number;
  expired: number;
  suspended: number;
  gracePeriod: number;
  startingThisMonth: number;
  renewingThisMonth: number;
  endingIn7Days: number;
  paymentFailed: number;
  noActivePlan: number;
  mrr: Record<string, number>;
  arr: Record<string, number>;
  mrrPolicy: string;
  duplicateActiveCompanyCount: number;
  mrrDuplicateExcess: Record<string, number>;
};

export type ActiveSubForMrr = {
  lockedPlanPrice: {
    currency: string;
    monthlyEquivalentMinor: number;
  } | null;
};

/**
 * Pure MRR calculation from a list of active subscriptions.
 * CANCEL_AT_PERIOD_END subscriptions are included: they have active access
 * and their revenue counts until the period ends.
 * Returns minor units by currency.
 */
export function calculateMrrMinorFromSubs(subs: ActiveSubForMrr[]): Record<string, number> {
  const mrrByCurrency: Record<string, number> = {};
  for (const sub of subs) {
    const price = sub.lockedPlanPrice;
    if (!price) continue;
    const currency = price.currency ?? "TRY";
    const monthlyMinor = price.monthlyEquivalentMinor ?? 0;
    if (monthlyMinor <= 0) continue;
    mrrByCurrency[currency] = (mrrByCurrency[currency] ?? 0) + monthlyMinor;
  }
  return mrrByCurrency;
}

export async function getAdminSubscriptionMetrics(): Promise<SubscriptionMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    active,
    trial,
    pastDue,
    cancelAtPeriodEnd,
    cancelled,
    expired,
    suspended,
    gracePeriod,
    startingThisMonth,
    renewingThisMonth,
    endingIn7Days,
    noActivePlan,
    activeSubs,
  ] = await Promise.all([
    db.companySubscription.count(),
    db.companySubscription.count({ where: { status: "ACTIVE" } }),
    db.companySubscription.count({ where: { status: "TRIAL" } }),
    db.companySubscription.count({ where: { status: "PAST_DUE" } }),
    db.companySubscription.count({ where: { status: "CANCEL_AT_PERIOD_END" } }),
    db.companySubscription.count({ where: { status: "CANCELLED" } }),
    db.companySubscription.count({ where: { status: "EXPIRED" } }),
    db.companySubscription.count({ where: { status: "SUSPENDED" } }),
    db.companySubscription.count({ where: { status: "GRACE_PERIOD" } }),
    db.companySubscription.count({
      where: { status: "ACTIVE", createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    db.companySubscription.count({
      where: { status: "ACTIVE", currentPeriodStart: { gte: monthStart, lte: monthEnd } },
    }),
    db.companySubscription.count({
      where: {
        status: { in: ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END"] },
        currentPeriodEnd: { gte: now, lte: in7Days },
      },
    }),
    db.companySubscription.count({
      where: { status: { in: ["ACTIVE", "TRIAL"] }, planId: null },
    }),
    // MRR: ACTIVE and CANCEL_AT_PERIOD_END — both have active access and represent real revenue
    db.companySubscription.findMany({
      where: {
        status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] },
        planId: { not: null },
        OR: [
          { lockedPriceMinor: { not: null } },
          { lockedListPriceMinor: { not: null } },
        ],
      },
      select: {
        id: true,
        companyId: true,
        billingInterval: true,
        lockedPriceMinor: true,
        lockedListPriceMinor: true,
        lockedPlanPrice: {
          select: {
            currency: true,
            monthlyEquivalentMinor: true,
            salePriceMinor: true,
            billingInterval: true,
          },
        },
      },
    }),
  ]);

  const paymentFailed = await db.companySubscription.count({
    where: {
      status: { in: ["ACTIVE", "PAST_DUE", "GRACE_PERIOD"] },
      failedPaymentCount: { gt: 0 },
    },
  });

  const mrrAnalysis = calculateMrrWithDuplicateAwareness(
    activeSubs.map((s) => ({
      companyId: s.companyId,
      subscriptionId: s.id,
      lockedPlanPrice: s.lockedPlanPrice,
    }))
  );
  const mrrMinor = mrrAnalysis.mrrMinor;
  const mrrMajor: Record<string, number> = {};
  const arrMajor: Record<string, number> = {};
  const mrrDuplicateExcess: Record<string, number> = {};
  for (const dup of mrrAnalysis.duplicateCompanies) {
    for (const [cur, v] of Object.entries(dup.excessMrrMinor)) {
      mrrDuplicateExcess[cur] = (mrrDuplicateExcess[cur] ?? 0) + v;
    }
  }
  for (const [cur, v] of Object.entries(mrrMinor)) {
    mrrMajor[cur] = v / 100;
    arrMajor[cur] = (v * 12) / 100;
  }
  for (const [cur, v] of Object.entries(mrrDuplicateExcess)) {
    mrrDuplicateExcess[cur] = v / 100;
  }

  return {
    total,
    active,
    trial,
    pastDue,
    cancelAtPeriodEnd,
    cancelled,
    expired,
    suspended,
    gracePeriod,
    startingThisMonth,
    renewingThisMonth,
    endingIn7Days,
    paymentFailed,
    noActivePlan,
    mrr: mrrMajor,
    arr: arrMajor,
    mrrPolicy: MRR_POLICY_DESCRIPTION,
    duplicateActiveCompanyCount: mrrAnalysis.duplicateCompanies.length,
    mrrDuplicateExcess,
  };
}
