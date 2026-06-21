import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import {
  calculateMembershipEndDate,
  getMembershipPeriodMonths,
  resolveMembershipPeriodStart,
} from "@/lib/membership-utils";

export const DEFAULT_VAT_RATE = 20;

export function resolvePaidPeriod(input: {
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  period: MembershipPeriod;
  referenceDate?: Date;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const trialBase =
    input.trialEndsAt && input.trialEndsAt > referenceDate
      ? input.trialEndsAt
      : null;
  const base = trialBase ?? input.currentPeriodEnd ?? null;
  const periodStart = resolveMembershipPeriodStart(base, referenceDate);
  const periodEnd = calculateMembershipEndDate(periodStart, input.period);

  return { periodStart, periodEnd };
}

export function periodMonths(period: MembershipPeriod) {
  return getMembershipPeriodMonths(period);
}

export function nextBillingDate(periodEnd: Date, autoRenew: boolean) {
  return autoRenew ? periodEnd : null;
}
