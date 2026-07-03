import type { MembershipPeriod } from "@prisma/client";
import {
  calculateDiscountPercent,
  getBillingIntervalMonths,
  salePriceFromPercent,
} from "@/lib/billing/pricing-utils";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";

export const PLAN_BILLING_PERIODS = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "YEARLY",
] as const satisfies readonly MembershipPeriod[];

export type PlanBillingPeriod = (typeof PLAN_BILLING_PERIODS)[number];

export const PERIOD_UI_LABELS: Record<PlanBillingPeriod, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

export const DEFAULT_PERIOD_DISCOUNTS: Record<
  Exclude<PlanBillingPeriod, "MONTHLY">,
  number
> = {
  QUARTERLY: 5,
  SEMI_ANNUAL: 10,
  YEARLY: 20,
};

export class PlanPeriodPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanPeriodPricingError";
  }
}

export function parsePlanMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseTurkishMoneyInput(trimmed);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

export function moneyToMinor(amount: number): number {
  return Math.round(amount * 100);
}

export function minorToDisplayAmount(minor: number): number {
  return minor / 100;
}

export function assertValidDiscountPercent(percent: number): number {
  if (!Number.isFinite(percent)) {
    throw new PlanPeriodPricingError("İndirim oranı geçersiz.");
  }
  if (percent < 0) {
    throw new PlanPeriodPricingError("İndirim oranı negatif olamaz.");
  }
  if (percent >= 100) {
    throw new PlanPeriodPricingError("İndirim oranı %100 veya üzeri olamaz.");
  }
  return Math.round(percent * 10) / 10;
}

export function calculateListTotalMinor(
  monthlyPriceMinor: number,
  interval: MembershipPeriod
): number {
  if (monthlyPriceMinor <= 0) {
    throw new PlanPeriodPricingError("Aylık fiyat sıfırdan büyük olmalıdır.");
  }
  return monthlyPriceMinor * getBillingIntervalMonths(interval);
}

export function calculatePeriodPriceFromDiscount(input: {
  monthlyPriceMinor: number;
  interval: MembershipPeriod;
  discountPercent: number;
}) {
  const discountPercent = assertValidDiscountPercent(input.discountPercent);
  const listPriceMinor = calculateListTotalMinor(input.monthlyPriceMinor, input.interval);
  const salePriceMinor = salePriceFromPercent(listPriceMinor, discountPercent);
  if (salePriceMinor <= 0) {
    throw new PlanPeriodPricingError("İndirim sonrası fiyat sıfırdan büyük olmalıdır.");
  }
  return { listPriceMinor, salePriceMinor, discountPercent };
}

export function calculateDiscountFromManualTotal(input: {
  monthlyPriceMinor: number;
  interval: MembershipPeriod;
  manualTotalMinor: number;
}) {
  if (input.manualTotalMinor <= 0) {
    throw new PlanPeriodPricingError("Manuel fiyat sıfırdan büyük olmalıdır.");
  }
  const listPriceMinor = calculateListTotalMinor(input.monthlyPriceMinor, input.interval);
  if (input.manualTotalMinor > listPriceMinor) {
    throw new PlanPeriodPricingError("Manuel fiyat normal toplamdan yüksek olamaz.");
  }
  const discountPercent = calculateDiscountPercent(listPriceMinor, input.manualTotalMinor);
  if (discountPercent >= 100) {
    throw new PlanPeriodPricingError("İndirim oranı %100 veya üzeri olamaz.");
  }
  return {
    listPriceMinor,
    salePriceMinor: input.manualTotalMinor,
    discountPercent,
  };
}

export function resolvePeriodPriceMinor(input: {
  monthlyPriceMinor: number;
  interval: MembershipPeriod;
  enabled: boolean;
  discountPercent?: number;
  salePriceMinor?: number;
}) {
  if (!input.enabled) return null;
  if (input.interval === "MONTHLY") {
    if (!input.salePriceMinor || input.salePriceMinor <= 0) {
      throw new PlanPeriodPricingError("Aylık fiyat zorunludur.");
    }
    return {
      listPriceMinor: input.salePriceMinor,
      salePriceMinor: input.salePriceMinor,
      discountPercent: 0,
    };
  }

  if (input.salePriceMinor != null) {
    return calculateDiscountFromManualTotal({
      monthlyPriceMinor: input.monthlyPriceMinor,
      interval: input.interval,
      manualTotalMinor: input.salePriceMinor,
    });
  }

  return calculatePeriodPriceFromDiscount({
    monthlyPriceMinor: input.monthlyPriceMinor,
    interval: input.interval,
    discountPercent: input.discountPercent ?? 0,
  });
}
