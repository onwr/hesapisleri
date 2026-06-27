import "server-only";

import type {
  DiscountType,
  MembershipCampaignStatus,
  MembershipPeriod,
} from "@prisma/client";
import { countActiveRedemptions } from "@/lib/billing/discount-reservation-service";
import { getActivePlanPrice } from "@/lib/billing/price-resolution-service";
import { PriceResolutionError } from "@/lib/billing/price-resolution-service";
import { detectCampaignConflicts } from "@/lib/admin/promotions/campaign-conflict-service";

export type CampaignIssueCode =
  | "INVALID_DATE_RANGE"
  | "ACTIVE_WITHOUT_TARGET"
  | "ACTIVE_WITHOUT_VALID_PRICE"
  | "CURRENCY_MISMATCH"
  | "DISCOUNT_INVALID"
  | "FIXED_DISCOUNT_EXCEEDS_PRICE"
  | "USAGE_LIMIT_REACHED"
  | "START_DATE_PASSED_DRAFT"
  | "END_DATE_PASSED_ACTIVE"
  | "ARCHIVED_PLAN_TARGET"
  | "DUPLICATE_TARGET"
  | "CONFLICTING_CAMPAIGN"
  | "REDEMPTION_COUNT_MISMATCH";

export type CampaignIssue = {
  code: CampaignIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
};

export type CampaignScopeLike = {
  planId: string | null;
  billingInterval: MembershipPeriod | null;
  companyId: string | null;
  partnerId: string | null;
};

export type CampaignIssueInput = {
  id: string;
  status: MembershipCampaignStatus;
  discountType: DiscountType;
  discountValue: number;
  overridePriceMinor: number | null;
  currency: string;
  startsAt: Date;
  endsAt: Date | null;
  maxRedemptions: number | null;
  autoApply: boolean;
  stackable: boolean;
  priority: number;
  scopes: CampaignScopeLike[];
  redemptionCountAll?: number;
  redemptionCountFinalized?: number;
  planById?: Map<
    string,
    { planStatus: string; defaultCurrency: string; currency: string }
  >;
  now?: Date;
};

function scopeKey(s: CampaignScopeLike) {
  return [
    s.planId ?? "",
    s.billingInterval ?? "",
    s.companyId ?? "",
    s.partnerId ?? "",
  ].join("|");
}

export function detectDiscountIssues(
  discountType: DiscountType,
  discountValue: number
): CampaignIssue[] {
  const issues: CampaignIssue[] = [];
  if (discountType === "PERCENTAGE" && (discountValue <= 0 || discountValue > 100)) {
    issues.push({
      code: "DISCOUNT_INVALID",
      severity: "error",
      message: "Yüzde indirim 0–100 aralığında olmalıdır.",
    });
  } else if (discountValue <= 0) {
    issues.push({
      code: "DISCOUNT_INVALID",
      severity: "error",
      message: "İndirim değeri sıfırdan büyük olmalıdır.",
    });
  }
  return issues;
}

export async function detectCampaignIssues(
  input: CampaignIssueInput
): Promise<CampaignIssue[]> {
  const issues: CampaignIssue[] = [];
  const now = input.now ?? new Date();

  if (input.endsAt && input.endsAt <= input.startsAt) {
    issues.push({
      code: "INVALID_DATE_RANGE",
      severity: "error",
      message: "Bitiş tarihi başlangıçtan sonra olmalıdır.",
    });
  }

  issues.push(...detectDiscountIssues(input.discountType, input.discountValue));

  if (input.status === "DRAFT" && input.startsAt < now) {
    issues.push({
      code: "START_DATE_PASSED_DRAFT",
      severity: "warning",
      message: "Taslak kampanyanın başlangıç tarihi geçmiş.",
    });
  }

  if (
    (input.status === "ACTIVE" || input.status === "SCHEDULED") &&
    input.endsAt &&
    input.endsAt <= now
  ) {
    issues.push({
      code: "END_DATE_PASSED_ACTIVE",
      severity: "error",
      message: "Aktif/zamanlanmış kampanyanın bitiş tarihi geçmiş.",
    });
  }

  const scopedPlans = input.scopes.map((s) => s.planId).filter(Boolean) as string[];
  const hasPlanTarget = scopedPlans.length > 0;
  const isLive = ["ACTIVE", "SCHEDULED"].includes(input.status);

  if (isLive && input.scopes.length === 0) {
    issues.push({
      code: "ACTIVE_WITHOUT_TARGET",
      severity: "error",
      message: "Yayında kampanyanın hedef kapsamı tanımlı değil.",
    });
  }

  const seen = new Set<string>();
  for (const scope of input.scopes) {
    const key = scopeKey(scope);
    if (seen.has(key)) {
      issues.push({
        code: "DUPLICATE_TARGET",
        severity: "error",
        message: "Aynı hedef kapsam birden fazla kez tanımlı.",
      });
      break;
    }
    seen.add(key);
  }

  if (input.planById) {
    for (const planId of scopedPlans) {
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

  if (input.maxRedemptions != null && input.redemptionCountFinalized != null) {
    if (input.redemptionCountFinalized >= input.maxRedemptions) {
      issues.push({
        code: "USAGE_LIMIT_REACHED",
        severity: "warning",
        message: "Kampanya kullanım limiti dolmuş.",
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

  if (isLive && hasPlanTarget && input.planById) {
    let priceOk = false;
    for (const scope of input.scopes) {
      if (!scope.planId) continue;
      const plan = input.planById.get(scope.planId);
      if (!plan) continue;
      const planCurrency = plan.defaultCurrency || plan.currency;
      if (planCurrency !== input.currency) {
        issues.push({
          code: "CURRENCY_MISMATCH",
          severity: "error",
          message: `Kampanya para birimi (${input.currency}) plan para birimi (${planCurrency}) ile uyumsuz.`,
        });
        continue;
      }
      const interval = scope.billingInterval ?? "MONTHLY";
      try {
        const price = await getActivePlanPrice({
          planId: scope.planId,
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
          // no purchasable price
        }
      }
    }
    if (!priceOk && !issues.some((i) => i.code === "CURRENCY_MISMATCH")) {
      issues.push({
        code: "ACTIVE_WITHOUT_VALID_PRICE",
        severity: "error",
        message: "Hedef planlar için geçerli satın alınabilir fiyat bulunamadı.",
      });
    }
  }

  if (input.autoApply && isLive) {
    const conflicts = await detectCampaignConflicts({
      campaignId: input.id,
      discountType: input.discountType,
      priority: input.priority,
      autoApply: input.autoApply,
      stackable: input.stackable,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      scopes: input.scopes,
    });
    const blocking = conflicts.find((c) => c.severity === "BLOCKING");
    if (blocking) {
      issues.push({
        code: "CONFLICTING_CAMPAIGN",
        severity: "error",
        message: blocking.message,
      });
    }
  }

  return issues;
}

export async function assertCampaignActivationAllowed(input: CampaignIssueInput) {
  const issues = await detectCampaignIssues(input);
  const blocking = issues.filter((i) => i.severity === "error");
  if (blocking.length) {
    const { PromotionError } = await import("@/lib/admin/promotions/promotion-errors");
    throw new PromotionError(blocking[0]!.message, 400);
  }
}

export async function loadPlanMapForScopes(
  scopes: CampaignScopeLike[]
): Promise<Map<string, { planStatus: string; defaultCurrency: string; currency: string }>> {
  const planIds = [...new Set(scopes.map((s) => s.planId).filter(Boolean))] as string[];
  if (!planIds.length) return new Map();
  const { db } = await import("@/lib/prisma");
  const plans = await db.membershipPlan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, planStatus: true, defaultCurrency: true, currency: true },
  });
  return new Map(plans.map((p) => [p.id, p]));
}

export async function countFinalizedRedemptions(campaignId: string) {
  const { db } = await import("@/lib/prisma");
  return db.membershipDiscountRedemption.count({
    where: { campaignId, type: "CAMPAIGN", status: "FINALIZED" },
  });
}
