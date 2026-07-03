import { PrismaClient } from "@prisma/client";
import { resolveCanonicalBillingPeriod } from "../lib/billing/canonical-billing-period.ts";

const db = new PrismaClient();
const sourceId = "plan-standard";
const targetId = "cmr419g4m0004v84shvn2wgqn";

try {
  const subs = await db.companySubscription.findMany({
    where: {
      planId: sourceId,
      status: { in: ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END", "PAST_DUE", "GRACE_PERIOD"] },
    },
    select: { id: true, companyId: true, billingInterval: true },
  });
  const companyIds = subs.map((s) => s.companyId);
  const payments = await db.membershipPayment.findMany({
    where: { companyId: { in: companyIds }, status: "PAID" },
    orderBy: { paidAt: "desc" },
    distinct: ["companyId"],
    select: {
      companyId: true,
      period: true,
      planPrice: { select: { billingInterval: true } },
    },
  });
  const payMap = new Map(payments.map((p) => [p.companyId, p]));
  let resolved = 0;
  let unresolved = 0;
  for (const s of subs) {
    const p = payMap.get(s.companyId);
    const period = resolveCanonicalBillingPeriod({
      billingInterval: s.billingInterval,
      lastPaymentPeriod: p?.period,
      lastPaymentPlanPriceBillingInterval: p?.planPrice?.billingInterval,
    });
    if (period) resolved += 1;
    else unresolved += 1;
  }

  const targetPrices = await db.membershipPlanPrice.findMany({
    where: { planId: targetId, status: "ACTIVE", salePriceMinor: { gt: 0 } },
    select: { id: true, billingInterval: true, salePriceMinor: true },
  });

  console.log(
    JSON.stringify(
      {
        sourceSubs: subs.length,
        resolvedSourcePeriods: resolved,
        unresolvedSourcePeriods: unresolved,
        targetActivePrices: targetPrices,
        wouldMigrateWithFallbackMonthly: unresolved === subs.length ? subs.length : "mixed",
      },
      null,
      2
    )
  );
} finally {
  await db.$disconnect();
}
