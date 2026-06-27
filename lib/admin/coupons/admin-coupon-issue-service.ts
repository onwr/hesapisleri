import "server-only";

import type { DiscountType, MembershipCouponStatus, MembershipPeriod } from "@prisma/client";
import { countActiveRedemptions } from "@/lib/billing/discount-reservation-service";
import { getActivePlanPrice } from "@/lib/billing/price-resolution-service";
import { PriceResolutionError } from "@/lib/billing/price-resolution-service";

export type CouponIssueCode =
  | "INVALID_DATE_RANGE"
  | "INVALID_DISCOUNT"
  | "CURRENCY_MISMATCH"
  | "ACTIVE_WITHOUT_TARGET"
  | "ARCHIVED_PLAN_TARGET"
  | "USAGE_LIMIT_REACHED"
  | "PER_COMPANY_LIMIT_INVALID"
  | "START_DATE_PASSED_DRAFT"
  | "END_DATE_PASSED_ACTIVE"
  | "DUPLICATE_SCOPE"
  | "STACKING_CONFLICT"
  | "FIXED_DISCOUNT_EXCEEDS_PRICE"
  | "REDEMPTION_COUNT_MISMATCH";

export type CouponIssue = {
  code: CouponIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

export type CouponIssueInput = {
  id: string;
  status: MembershipCouponStatus;
  discountType: DiscountType;
  discountValue: number;
  currency: string;
  startsAt: Date;
  expiresAt: Date | null;
  maxUsage: number | null;
  maxUsagePerCompany: number;
  stackable: boolean;
  allowedIntervals: MembershipPeriod[];
  planIds: string[];
  redemptionCountAll?: number;
  redemptionCountFinalized?: number;
  planById?: Map<string, { planStatus: string; defaultCurrency: string; currency: string }>;
  now?: Date;
};

export function detectCouponDiscountIssues(
  discountType: DiscountType,
  discountValue: number
): CouponIssue[] {
  const issues: CouponIssue[] = [];
  if (discountType === "PERCENTAGE" && (discountValue <= 0 || discountValue > 100)) {
    issues.push({
      code: "INVALID_DISCOUNT",
      severity: "error",
      message: "Yüzde indirim 0–100 aralığında olmalıdır.",
    });
  } else if (discountValue <= 0) {
    issues.push({
      code: "INVALID_DISCOUNT",
      severity: "error",
      message: "İndirim değeri sıfırdan büyük olmalıdır.",
    });
  }
  return issues;
}

export async function detectCouponIssues(input: CouponIssueInput): Promise<CouponIssue[]> {
  const issues: CouponIssue[] = [];
  const now = input.now ?? new Date();

  if (input.expiresAt && input.expiresAt <= input.startsAt) {
    issues.push({
      code: "INVALID_DATE_RANGE",
      severity: "error",
      message: "Bitiş tarihi başlangıçtan sonra olmalıdır.",
    });
  }

  issues.push(...detectCouponDiscountIssues(input.discountType, input.discountValue));

  if (input.maxUsagePerCompany <= 0) {
    issues.push({
      code: "PER_COMPANY_LIMIT_INVALID",
      severity: "error",
      message: "Firma başına kullanım limiti en az 1 olmalıdır.",
    });
  }

  if (input.status === "DRAFT" && input.startsAt < now) {
    issues.push({
      code: "START_DATE_PASSED_DRAFT",
      severity: "warning",
      message: "Taslak kuponun başlangıç tarihi geçmiş.",
    });
  }

  if (
    (input.status === "ACTIVE" || input.status === "PAUSED") &&
    input.expiresAt &&
    input.expiresAt <= now
  ) {
    issues.push({
      code: "END_DATE_PASSED_ACTIVE",
      severity: "error",
      message: "Aktif kuponun bitiş tarihi geçmiş.",
    });
  }

  const uniquePlans = [...new Set(input.planIds)];
  if (uniquePlans.length !== input.planIds.length) {
    issues.push({
      code: "DUPLICATE_SCOPE",
      severity: "error",
      message: "Aynı plan hedefi birden fazla kez tanımlı.",
    });
  }

  if (input.planById) {
    for (const planId of uniquePlans) {
      const plan = input.planById.get(planId);
      if (plan?.planStatus === "ARCHIVED") {
        issues.push({
          code: "ARCHIVED_PLAN_TARGET",
          severity: "error",
          message: "Arşivlenmiş plan hedeflenemez.",
        });
      }
    }
  }

  if (input.maxUsage != null && input.redemptionCountFinalized != null) {
    if (input.redemptionCountFinalized >= input.maxUsage) {
      issues.push({
        code: "USAGE_LIMIT_REACHED",
        severity: "warning",
        message: "Kupon kullanım limiti dolmuş.",
      });
    }
  }

  if (
    input.redemptionCountAll != null &&
    input.redemptionCountFinalized != null &&
    input.redemptionCountFinalized > input.redemptionCountAll
  ) {
    issues.push({
      code: "REDEMPTION_COUNT_MISMATCH",
      severity: "warning",
      message: "Kullanım sayısı tutarsız görünüyor.",
    });
  }

  const isLive = input.status === "ACTIVE";
  if (isLive && uniquePlans.length === 0 && input.allowedIntervals.length === 0) {
    issues.push({
      code: "ACTIVE_WITHOUT_TARGET",
      severity: "warning",
      message: "Aktif kupon için plan veya dönem hedefi tanımlı değil (tüm planlar).",
    });
  }

  if (isLive && uniquePlans.length && input.planById) {
    let priceOk = false;
    const interval = input.allowedIntervals[0] ?? "MONTHLY";
    for (const planId of uniquePlans) {
      const plan = input.planById.get(planId);
      if (!plan) continue;
      const planCurrency = plan.defaultCurrency || plan.currency;
      if (planCurrency !== input.currency) {
        issues.push({
          code: "CURRENCY_MISMATCH",
          severity: "error",
          message: `Kupon para birimi (${input.currency}) plan para birimi (${planCurrency}) ile uyumsuz.`,
        });
        continue;
      }
      try {
        const price = await getActivePlanPrice({
          planId,
          billingInterval: interval,
          currency: input.currency,
          at: now,
        });
        if (price) {
          priceOk = true;
          if (
            input.discountType === "FIXED_AMOUNT" &&
            input.discountValue > price.salePriceMinor
          ) {
            issues.push({
              code: "FIXED_DISCOUNT_EXCEEDS_PRICE",
              severity: "error",
              message: "Sabit indirim satış fiyatını aşıyor.",
            });
          }
        }
      } catch (error) {
        if (error instanceof PriceResolutionError) {
          // no price
        }
      }
    }
    if (!priceOk && !issues.some((i) => i.code === "CURRENCY_MISMATCH")) {
      issues.push({
        code: "ACTIVE_WITHOUT_TARGET",
        severity: "error",
        message: "Hedef planlar için geçerli satın alınabilir fiyat bulunamadı.",
      });
    }
  }

  return issues;
}

export async function assertCouponActivationAllowed(input: CouponIssueInput) {
  const issues = await detectCouponIssues(input);
  const blocking = issues.filter((i) => i.severity === "error");
  if (blocking.length) {
    const { PromotionError } = await import("@/lib/admin/promotions/promotion-errors");
    throw new PromotionError(blocking[0]!.message, 400);
  }
}

export async function loadPlanMapForCouponPlans(planIds: string[]) {
  if (!planIds.length) return new Map();
  const { db } = await import("@/lib/prisma");
  const plans = await db.membershipPlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, planStatus: true, defaultCurrency: true, currency: true },
  });
  return new Map(plans.map((p) => [p.id, p]));
}

export async function countFinalizedCouponRedemptions(couponId: string) {
  const { db } = await import("@/lib/prisma");
  return db.membershipDiscountRedemption.count({
    where: { couponId, type: "COUPON", status: "FINALIZED" },
  });
}
