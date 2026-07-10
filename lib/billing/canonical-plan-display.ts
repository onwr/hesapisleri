import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  buildPriceTotals,
  calculateMonthlyEquivalentMinor,
  calculateSavingsMinor,
} from "@/lib/billing/pricing-utils";
import {
  getActivePlanPrice,
  PriceResolutionError,
} from "@/lib/billing/price-resolution-service";

export type CanonicalPlanDisplay = {
  code: string;
  name: string;
  currency: string;
  monthlyPrice: number;
  annualPrice: number | null;
  annualEquivalentMonthlyPrice: number | null;
  annualDiscountPercent: number | null;
  trialDays: number;
  billingPeriods: MembershipPeriod[];
  isPurchasable: boolean;
  isArchived: boolean;
  showAnnualDiscount: boolean;
};

const INTERNAL_TEST_PLAN_CODE = /^test$/i;
const INTERNAL_TEST_PLAN_CODE_PREFIX = /^test[-_]/i;
const INTERNAL_TEST_PLAN_NAME = /\btest\b|ana\s*paket\s*test/i;

export function isInternalTestMembershipPlan(plan: {
  name: string;
  code: string;
}) {
  const name = plan.name.trim();
  const code = plan.code.trim();
  if (INTERNAL_TEST_PLAN_CODE.test(code)) return true;
  if (INTERNAL_TEST_PLAN_CODE_PREFIX.test(code)) return true;
  if (INTERNAL_TEST_PLAN_NAME.test(name)) return true;
  return false;
}

export function sanitizeMembershipPlanDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (INTERNAL_TEST_PLAN_NAME.test(trimmed)) {
    return trimmed.replace(/\s*test\s*/gi, " ").replace(/\s+/g, " ").trim();
  }
  return trimmed;
}

async function resolveCatalogIntervalPrice(input: {
  planId: string;
  billingInterval: MembershipPeriod;
  at?: Date;
}) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: input.planId },
    select: {
      id: true,
      planStatus: true,
      vatRate: true,
      vatIncluded: true,
      defaultCurrency: true,
      currency: true,
    },
  });

  if (!plan || plan.planStatus !== "ACTIVE") {
    return null;
  }

  try {
    const planPrice = await getActivePlanPrice({
      planId: input.planId,
      billingInterval: input.billingInterval,
      at: input.at,
    });

    if (!planPrice) {
      return null;
    }

    const totals = buildPriceTotals({
      listPriceMinor: planPrice.listPriceMinor,
      salePriceMinor: planPrice.salePriceMinor,
      interval: input.billingInterval,
      vatRate: planPrice.vatRate ?? plan.vatRate,
      vatIncluded: planPrice.vatIncluded ?? plan.vatIncluded,
    });

    return {
      currency: plan.defaultCurrency || plan.currency,
      salePriceMinor: totals.salePriceMinor,
      monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
    };
  } catch (error) {
    if (error instanceof PriceResolutionError) {
      return null;
    }
    throw error;
  }
}

export async function buildCanonicalPlanDisplay(input: {
  plan: {
    id: string;
    code: string;
    name: string;
    currency: string;
    defaultCurrency?: string | null;
    planStatus: string;
    trialEnabled: boolean;
    trialDays: number;
  };
  platformTrialDays: number;
}): Promise<CanonicalPlanDisplay | null> {
  if (isInternalTestMembershipPlan(input.plan)) {
    return null;
  }

  const [monthly, yearly] = await Promise.all([
    resolveCatalogIntervalPrice({
      planId: input.plan.id,
      billingInterval: "MONTHLY",
    }),
    resolveCatalogIntervalPrice({
      planId: input.plan.id,
      billingInterval: "YEARLY",
    }),
  ]);

  if (!monthly) {
    return null;
  }

  const monthlyPrice = monthly.salePriceMinor / 100;
  const annualPrice = yearly ? yearly.salePriceMinor / 100 : null;
  const annualEquivalentMonthlyPrice = yearly
    ? yearly.monthlyEquivalentMinor / 100
    : null;

  const annualDiscountPercent =
    yearly && monthly
      ? Math.round(
          (calculateSavingsMinor(
            monthly.salePriceMinor,
            yearly.salePriceMinor,
            "YEARLY"
          ) /
            (monthly.salePriceMinor * 12)) *
            1000
        ) / 10
      : null;

  const showAnnualDiscount =
    annualPrice != null &&
    annualEquivalentMonthlyPrice != null &&
    annualPrice < monthlyPrice * 12 &&
    annualDiscountPercent != null &&
    annualDiscountPercent > 0;

  const billingPeriods: MembershipPeriod[] = ["MONTHLY"];
  if (yearly) {
    billingPeriods.push("YEARLY");
  }

  const trialDays = input.plan.trialEnabled
    ? input.platformTrialDays
    : 0;

  return {
    code: input.plan.code,
    name: sanitizeMembershipPlanDisplayName(input.plan.name),
    currency: monthly.currency || input.plan.defaultCurrency || input.plan.currency,
    monthlyPrice,
    annualPrice,
    annualEquivalentMonthlyPrice: showAnnualDiscount
      ? annualEquivalentMonthlyPrice
      : null,
    annualDiscountPercent: showAnnualDiscount ? annualDiscountPercent : null,
    trialDays,
    billingPeriods,
    isPurchasable: input.plan.planStatus === "ACTIVE",
    isArchived: input.plan.planStatus === "ARCHIVED",
    showAnnualDiscount,
  };
}

export function minorToDisplayAmount(minor: number) {
  return minor / 100;
}

export function getAnnualEquivalentMonthlyFromMinor(
  annualSalePriceMinor: number
) {
  return calculateMonthlyEquivalentMinor(annualSalePriceMinor, "YEARLY") / 100;
}
