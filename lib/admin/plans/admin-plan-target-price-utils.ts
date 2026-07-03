import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { assertSingleEffectivePrice } from "@/lib/admin/plans/admin-plan-price-resolution-utils";

const BILLING_INTERVALS: MembershipPeriod[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
];

export type TargetPlanActivePrice = {
  id: string;
  billingInterval: MembershipPeriod;
  salePriceMinor: number;
  listPriceMinor: number;
  currency: string;
  status: string;
};

export async function loadTargetActivePricesByPeriod(
  planId: string,
  now = new Date()
): Promise<Map<MembershipPeriod, TargetPlanActivePrice>> {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    select: { defaultCurrency: true, currency: true },
  });
  const currency = plan?.defaultCurrency || plan?.currency || "TRY";

  const prices = await db.membershipPlanPrice.findMany({
    where: {
      planId,
      currency,
      status: { in: ["ACTIVE", "SCHEDULED"] },
    },
    select: {
      id: true,
      billingInterval: true,
      salePriceMinor: true,
      listPriceMinor: true,
      currency: true,
      status: true,
      effectiveFrom: true,
      effectiveUntil: true,
    },
    orderBy: [{ billingInterval: "asc" }, { version: "desc" }],
  });

  const result = new Map<MembershipPeriod, TargetPlanActivePrice>();
  for (const interval of BILLING_INTERVALS) {
    const effective = assertSingleEffectivePrice(prices, interval, currency, now);
    if (!effective || effective.salePriceMinor <= 0) continue;
    result.set(interval, {
      id: effective.id,
      billingInterval: interval,
      salePriceMinor: effective.salePriceMinor,
      listPriceMinor: effective.listPriceMinor,
      currency: effective.currency,
      status: effective.status,
    });
  }
  return result;
}
