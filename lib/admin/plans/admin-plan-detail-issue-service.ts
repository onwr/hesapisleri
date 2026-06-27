import type { MembershipPeriod, PlanPriceStatus, PlanStatus } from "@prisma/client";
import type { PlanPricingClass, PurchasablePrice } from "@/lib/admin/plans/admin-plan-classification";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";
import { findPriceResolutionConflicts } from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { priceRangesOverlap } from "@/lib/admin/plans/admin-plan-price-overlap";

export type PlanDetailIssueCode =
  | "PRICE_MISSING_CHECKOUT"
  | "DUPLICATE_ACTIVE_PRICE"
  | "EFFECTIVE_DATE_OVERLAP"
  | "SALE_ABOVE_LIST_POLICY"
  | "NEGATIVE_OR_ZERO_PAID_PRICE"
  | "ACTIVE_PRICE_EXPIRED"
  | "RENEWAL_PRICE_GAP"
  | "PLAN_STATUS_ISACTIVE_MISMATCH"
  | "ARCHIVED_WITH_ACTIVE_SUBS"
  | "PENDING_CHANGE_TO_ARCHIVED"
  | "CURRENCY_MISMATCH"
  | "MIXED_PRICING"
  | "UNCONFIGURED_PRICING"
  | "LEGACY_PRICE_MISMATCH"
  | "DUPLICATE_ACTIVE_SUBSCRIPTION";

export type PlanDetailIssue = {
  code: PlanDetailIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
  tab?: "overview" | "pricing" | "subscriptions" | "entitlements";
};

export type PlanDetailIssueInput = {
  planStatus: PlanStatus;
  isActive: boolean;
  defaultCurrency: string;
  legacyPrices: {
    monthly: number;
    quarterly: number;
    semiAnnual: number;
    yearly: number;
  };
  prices: Array<
    PurchasablePrice & {
      id: string;
      listPriceMinor: number;
      salePriceMinor: number;
      billingInterval: MembershipPeriod;
      status: PlanPriceStatus;
    }
  >;
  subscriptionStats: {
    active: number;
    trial: number;
    cancelAtPeriodEnd: number;
    duplicateActiveCompanies: number;
  };
  pendingChangeTargetCount: number;
  supportsMultiCurrency: boolean;
  now?: Date;
};

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

export function detectPlanDetailIssues(input: PlanDetailIssueInput): PlanDetailIssue[] {
  const issues: PlanDetailIssue[] = [];
  const now = input.now ?? new Date();
  const pricingClass = classifyPlanPricing(input.prices, now);
  const conflicts = findPriceResolutionConflicts(input.prices, now);

  if (
    (input.planStatus === "ACTIVE" && !input.isActive) ||
    (input.planStatus === "ARCHIVED" && input.isActive) ||
    (input.planStatus === "DRAFT" && input.isActive)
  ) {
    issues.push({
      code: "PLAN_STATUS_ISACTIVE_MISMATCH",
      severity: "warning",
      message: "planStatus ile legacy isActive tutarsız.",
      tab: "overview",
    });
  }

  if (input.planStatus === "ARCHIVED" && input.subscriptionStats.active > 0) {
    issues.push({
      code: "ARCHIVED_WITH_ACTIVE_SUBS",
      severity: "info",
      message: `${input.subscriptionStats.active} aktif abonelik arşivli planda devam ediyor.`,
      tab: "subscriptions",
    });
  }

  if (input.pendingChangeTargetCount > 0) {
    issues.push({
      code: "PENDING_CHANGE_TO_ARCHIVED",
      severity: "warning",
      message: `${input.pendingChangeTargetCount} bekleyen plan değişikliği bu planı hedefliyor.`,
      tab: "subscriptions",
    });
  }

  if (pricingClass === "UNCONFIGURED") {
    issues.push({
      code: "UNCONFIGURED_PRICING",
      severity: "warning",
      message: "Satın alınabilir efektif fiyat yok.",
      tab: "pricing",
    });
  }

  if (input.planStatus === "ACTIVE" && pricingClass === "UNCONFIGURED") {
    issues.push({
      code: "PRICE_MISSING_CHECKOUT",
      severity: "error",
      message: "Checkout için satın alınabilir efektif fiyat yok.",
      tab: "pricing",
    });
  }

  if (pricingClass === "MIXED") {
    issues.push({
      code: "MIXED_PRICING",
      severity: "info",
      message: "Hem ücretsiz hem ücretli satın alınabilir seçenekler var.",
      tab: "pricing",
    });
  }

  for (const interval of conflicts) {
    issues.push({
      code: "DUPLICATE_ACTIVE_PRICE",
      severity: "error",
      message: `${interval} için birden fazla efektif fiyat çözümleniyor (PRICE_RESOLUTION_CONFLICT).`,
      tab: "pricing",
    });
  }

  if (!input.supportsMultiCurrency) {
    const currencies = new Set(
      input.prices
        .filter((p) => ["ACTIVE", "SCHEDULED"].includes(p.status))
        .map((p) => p.currency)
    );
    if ([...currencies].some((c) => c !== input.defaultCurrency)) {
      issues.push({
        code: "CURRENCY_MISMATCH",
        severity: "warning",
        message: `Varsayılan para birimi ${input.defaultCurrency}; farklı currency fiyatları mevcut.`,
        tab: "pricing",
      });
    }
  }

  for (const price of input.prices) {
    if (price.salePriceMinor < 0 || price.listPriceMinor < 0) {
      issues.push({
        code: "NEGATIVE_OR_ZERO_PAID_PRICE",
        severity: "error",
        message: `${price.billingInterval} fiyatında negatif tutar.`,
        tab: "pricing",
      });
    }
    if (price.salePriceMinor > price.listPriceMinor) {
      issues.push({
        code: "SALE_ABOVE_LIST_POLICY",
        severity: "warning",
        message: `${price.billingInterval} satış fiyatı liste fiyatından yüksek.`,
        tab: "pricing",
      });
    }
    if (
      price.status === "ACTIVE" &&
      price.effectiveUntil &&
      price.effectiveUntil <= now
    ) {
      issues.push({
        code: "ACTIVE_PRICE_EXPIRED",
        severity: "error",
        message: `${price.billingInterval} ACTIVE fiyatının süresi dolmuş görünüyor.`,
        tab: "pricing",
      });
    }
  }

  const activeScheduled = input.prices.filter((p) =>
    ["ACTIVE", "SCHEDULED"].includes(p.status)
  );
  for (let i = 0; i < activeScheduled.length; i++) {
    for (let j = i + 1; j < activeScheduled.length; j++) {
      const a = activeScheduled[i];
      const b = activeScheduled[j];
      if (
        a.billingInterval === b.billingInterval &&
        a.currency === b.currency &&
        priceRangesOverlap(
          { effectiveFrom: a.effectiveFrom, effectiveUntil: a.effectiveUntil },
          { effectiveFrom: b.effectiveFrom, effectiveUntil: b.effectiveUntil }
        )
      ) {
        issues.push({
          code: "EFFECTIVE_DATE_OVERLAP",
          severity: "error",
          message: `${a.billingInterval}/${a.currency} tarih aralığı çakışması.`,
          tab: "pricing",
        });
      }
    }
  }

  for (const interval of INTERVALS) {
    const effective = input.prices.filter(
      (p) =>
        p.billingInterval === interval &&
        p.currency === input.defaultCurrency &&
        p.status === "ACTIVE" &&
        p.effectiveFrom <= now &&
        (!p.effectiveUntil || p.effectiveUntil > now)
    );
    if (effective.length === 1) {
      const legacyMinor = Math.round(
        (interval === "MONTHLY"
          ? input.legacyPrices.monthly
          : interval === "QUARTERLY"
            ? input.legacyPrices.quarterly
            : interval === "SEMI_ANNUAL"
              ? input.legacyPrices.semiAnnual
              : input.legacyPrices.yearly) * 100
      );
      if (Math.abs(effective[0].salePriceMinor - legacyMinor) > 1) {
        issues.push({
          code: "LEGACY_PRICE_MISMATCH",
          severity: "info",
          message: `${interval} legacy kolon ile MembershipPlanPrice tutarsız.`,
          tab: "pricing",
        });
      }
    }
  }

  if (input.subscriptionStats.duplicateActiveCompanies > 0) {
    issues.push({
      code: "DUPLICATE_ACTIVE_SUBSCRIPTION",
      severity: "warning",
      message: `${input.subscriptionStats.duplicateActiveCompanies} firmada birden fazla aktif abonelik kaydı.`,
      tab: "subscriptions",
    });
  }

  return issues;
}

export function getPlanDetailIssueLabel(code: PlanDetailIssueCode): string {
  const labels: Record<PlanDetailIssueCode, string> = {
    PRICE_MISSING_CHECKOUT: "Checkout fiyatı yok",
    DUPLICATE_ACTIVE_PRICE: "Çift efektif fiyat",
    EFFECTIVE_DATE_OVERLAP: "Tarih çakışması",
    SALE_ABOVE_LIST_POLICY: "Satış > liste",
    NEGATIVE_OR_ZERO_PAID_PRICE: "Geçersiz fiyat",
    ACTIVE_PRICE_EXPIRED: "Süresi dolmuş ACTIVE",
    RENEWAL_PRICE_GAP: "Yenileme boşluğu",
    PLAN_STATUS_ISACTIVE_MISMATCH: "Durum tutarsızlığı",
    ARCHIVED_WITH_ACTIVE_SUBS: "Arşiv + abonelik",
    PENDING_CHANGE_TO_ARCHIVED: "Bekleyen hedef",
    CURRENCY_MISMATCH: "Para birimi",
    MIXED_PRICING: "Karma fiyat",
    UNCONFIGURED_PRICING: "Fiyat yok",
    LEGACY_PRICE_MISMATCH: "Legacy uyumsuz",
    DUPLICATE_ACTIVE_SUBSCRIPTION: "Çift abonelik",
  };
  return labels[code];
}

export function hasBlockingIssuesForActivate(issues: PlanDetailIssue[]): boolean {
  const blocking: PlanDetailIssueCode[] = [
    "DUPLICATE_ACTIVE_PRICE",
    "EFFECTIVE_DATE_OVERLAP",
    "PRICE_MISSING_CHECKOUT",
    "ACTIVE_PRICE_EXPIRED",
    "NEGATIVE_OR_ZERO_PAID_PRICE",
  ];
  return issues.some((i) => blocking.includes(i.code) && i.severity === "error");
}
