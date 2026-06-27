import type { MembershipPeriod } from "@prisma/client";
import type { PlanPricingClass, PurchasablePrice } from "@/lib/admin/plans/admin-plan-classification";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";

export type PlanIssueCode =
  | "ARCHIVED_WITH_ACTIVE_SUBS"
  | "NO_PURCHASABLE_PRICE"
  | "MIXED_PRICING"
  | "UNCONFIGURED_PRICING"
  | "PLAN_STATUS_ISACTIVE_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PRICE_RESOLUTION_CONFLICT";

export type PlanIssue = {
  code: PlanIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END"] as const;

export function detectPlanIssues(input: {
  planStatus: import("@prisma/client").PlanStatus;
  isActive: boolean;
  defaultCurrency: string;
  prices: PurchasablePrice[];
  activeSubscriptionCount: number;
  supportsMultiCurrency: boolean;
  priceConflictIntervals: MembershipPeriod[];
  now?: Date;
}): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const now = input.now ?? new Date();
  const pricingClass = classifyPlanPricing(input.prices, now);

  if (
    (input.planStatus === "ACTIVE" && !input.isActive) ||
    (input.planStatus === "ARCHIVED" && input.isActive) ||
    (input.planStatus === "DRAFT" && input.isActive)
  ) {
    issues.push({
      code: "PLAN_STATUS_ISACTIVE_MISMATCH",
      severity: "warning",
      message: "planStatus ile legacy isActive alanı tutarsız.",
    });
  }

  if (input.planStatus === "ARCHIVED" && input.activeSubscriptionCount > 0) {
    issues.push({
      code: "ARCHIVED_WITH_ACTIVE_SUBS",
      severity: "info",
      message: `${input.activeSubscriptionCount} aktif abonelik arşivli planda devam ediyor.`,
    });
  }

  if (pricingClass === "UNCONFIGURED") {
    issues.push({
      code: "UNCONFIGURED_PRICING",
      severity: "warning",
      message: "Satın alınabilir efektif fiyat yok.",
    });
  }

  if (pricingClass === "MIXED") {
    issues.push({
      code: "MIXED_PRICING",
      severity: "info",
      message: "Hem ücretsiz hem ücretli satın alınabilir fiyat seçenekleri var.",
    });
  }

  if (input.planStatus === "ACTIVE" && pricingClass === "UNCONFIGURED") {
    issues.push({
      code: "NO_PURCHASABLE_PRICE",
      severity: "error",
      message: "Aktif plan checkout için satın alınabilir fiyat içermiyor.",
    });
  }

  if (!input.supportsMultiCurrency) {
    const currencies = new Set(
      input.prices
        .filter((p) => ["ACTIVE", "SCHEDULED"].includes(p.status))
        .map((p) => p.currency)
    );
    if (currencies.size > 1 || (currencies.size === 1 && !currencies.has(input.defaultCurrency))) {
      const hasNonDefault = [...currencies].some((c) => c !== input.defaultCurrency);
      if (hasNonDefault) {
        issues.push({
          code: "CURRENCY_MISMATCH",
          severity: "warning",
          message: `Plan varsayılan para birimi ${input.defaultCurrency}; farklı para birimli fiyatlar mevcut.`,
        });
      }
    }
  }

  for (const interval of input.priceConflictIntervals) {
    issues.push({
      code: "PRICE_RESOLUTION_CONFLICT",
      severity: "error",
      message: `${interval} için birden fazla efektif fiyat çözümleniyor.`,
    });
  }

  return issues;
}

export function getPlanIssueLabel(code: PlanIssueCode): string {
  const labels: Record<PlanIssueCode, string> = {
    ARCHIVED_WITH_ACTIVE_SUBS: "Arşiv + aktif abonelik",
    NO_PURCHASABLE_PRICE: "Satın alınamaz",
    MIXED_PRICING: "Karma fiyatlandırma",
    UNCONFIGURED_PRICING: "Fiyat yok",
    PLAN_STATUS_ISACTIVE_MISMATCH: "Durum tutarsızlığı",
    CURRENCY_MISMATCH: "Para birimi uyumsuzluğu",
    PRICE_RESOLUTION_CONFLICT: "Fiyat çakışması",
  };
  return labels[code];
}

export { ACTIVE_SUB_STATUSES };
