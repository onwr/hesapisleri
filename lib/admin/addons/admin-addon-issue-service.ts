import "server-only";

import type { MembershipAddOnStatus, MembershipAddOnType, MembershipPeriod } from "@prisma/client";
import {
  getEntitlementMeta,
  isKnownEntitlementCode,
} from "@/lib/billing/entitlements/entitlement-registry";
import { findEffectiveAddOnPricesAt } from "@/lib/admin/addons/admin-addon-price-resolution-utils";

export type AddOnIssueCode =
  | "ACTIVE_WITHOUT_PRICE"
  | "PRICE_OVERLAP"
  | "PRICE_RESOLUTION_CONFLICT"
  | "INVALID_PRICE"
  | "CURRENCY_MISMATCH"
  | "UNKNOWN_ENTITLEMENT"
  | "ENTITLEMENT_TYPE_MISMATCH"
  | "DUPLICATE_ENTITLEMENT"
  | "ARCHIVED_WITH_ACTIVE_SUBSCRIPTIONS"
  | "INVALID_QUANTITY"
  | "SUBSCRIPTION_RELATION_MISSING"
  | "SNAPSHOT_MISMATCH";

export type AddOnIssue = {
  code: AddOnIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

export type AddOnIssueInput = {
  id: string;
  status: MembershipAddOnStatus;
  type: MembershipAddOnType;
  currency: string;
  entitlementCode: string;
  entitlementQuantity: number;
  prices?: Array<{
    id: string;
    billingInterval: MembershipPeriod | null;
    currency: string;
    status: string;
    listPriceMinor: number;
    salePriceMinor: number;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  }>;
  activeSubscriptionCount?: number;
  now?: Date;
};

export function validateEntitlementCode(code: string): AddOnIssue[] {
  const issues: AddOnIssue[] = [];
  if (!isKnownEntitlementCode(code)) {
    issues.push({
      code: "UNKNOWN_ENTITLEMENT",
      severity: "error",
      message: "Bilinmeyen entitlement kodu.",
    });
    return issues;
  }
  const meta = getEntitlementMeta(code);
  if (!meta) {
    issues.push({
      code: "UNKNOWN_ENTITLEMENT",
      severity: "error",
      message: "Entitlement meta bulunamadı.",
    });
  }
  return issues;
}

export async function detectAddOnIssues(input: AddOnIssueInput): Promise<AddOnIssue[]> {
  const issues: AddOnIssue[] = [];
  const now = input.now ?? new Date();

  issues.push(...validateEntitlementCode(input.entitlementCode));

  if (input.entitlementQuantity <= 0) {
    issues.push({
      code: "INVALID_QUANTITY",
      severity: "error",
      message: "Entitlement miktarı pozitif olmalıdır.",
    });
  }

  const prices = input.prices ?? [];
  for (const price of prices) {
    if (price.listPriceMinor < 0 || price.salePriceMinor < 0) {
      issues.push({
        code: "INVALID_PRICE",
        severity: "error",
        message: "Fiyat negatif olamaz.",
      });
    }
    if (price.salePriceMinor > price.listPriceMinor) {
      issues.push({
        code: "INVALID_PRICE",
        severity: "warning",
        message: "Satış fiyatı liste fiyatını aşıyor.",
      });
    }
    if (price.currency !== input.currency) {
      issues.push({
        code: "CURRENCY_MISMATCH",
        severity: "error",
        message: `Fiyat para birimi (${price.currency}) add-on para birimi (${input.currency}) ile uyumsuz.`,
      });
    }
  }

  if (input.status === "ACTIVE") {
    const hasFreePolicy = prices.some(
      (p) => p.status === "ACTIVE" && p.salePriceMinor === 0 && p.effectiveFrom <= now
    );
    const hasPaidPrice = prices.some((p) => {
      if (p.status !== "ACTIVE") return false;
      if (p.effectiveFrom > now) return false;
      if (p.effectiveUntil && p.effectiveUntil <= now) return false;
      return true;
    });
    if (!hasFreePolicy && !hasPaidPrice) {
      issues.push({
        code: "ACTIVE_WITHOUT_PRICE",
        severity: "error",
        message: "Aktif add-on için geçerli fiyat bulunamadı.",
      });
    }
  }

  const intervals = new Set<string>();
  for (const price of prices) {
    const key = `${price.billingInterval ?? "ONE_TIME"}|${price.currency}`;
    const effective = findEffectiveAddOnPricesAt(
      prices,
      price.billingInterval,
      price.currency,
      now
    );
    if (effective.length > 1 && !intervals.has(key)) {
      intervals.add(key);
      issues.push({
        code: "PRICE_RESOLUTION_CONFLICT",
        severity: "error",
        message: `${price.billingInterval ?? "ONE_TIME"}/${price.currency} için birden fazla efektif fiyat var.`,
      });
    }
  }

  if (
    input.status === "ARCHIVED" &&
    (input.activeSubscriptionCount ?? 0) > 0
  ) {
    issues.push({
      code: "ARCHIVED_WITH_ACTIVE_SUBSCRIPTIONS",
      severity: "warning",
      message: "Arşivlenmiş add-on için aktif abonelik kayıtları var.",
    });
  }

  return issues;
}

export async function assertAddOnActivationAllowed(input: AddOnIssueInput) {
  const issues = await detectAddOnIssues(input);
  const blocking = issues.filter((i) => i.severity === "error");
  if (blocking.length) {
    const { AddOnServiceError } = await import("@/lib/admin/addons/addon-errors");
    throw new AddOnServiceError(blocking[0]!.message, 400);
  }
}
