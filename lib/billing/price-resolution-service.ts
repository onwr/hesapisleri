import "server-only";

import type {
  MembershipPeriod,
  PlanPriceStatus,
  SubscriptionPriceChangePolicy,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  resolveCampaignDiscounts,
  resolveCouponDiscount,
} from "@/lib/billing/discount-resolution-service";
import {
  buildPriceTotals,
  type ResolvedPriceTotals,
} from "@/lib/billing/pricing-utils";

export type AppliedDiscount = {
  type: "PLAN" | "CAMPAIGN" | "COUPON" | "PARTNER" | "OVERRIDE";
  id?: string;
  code?: string;
  label: string;
  amountMinor: number;
};

export type ResolvedSubscriptionPrice = ResolvedPriceTotals & {
  planId: string;
  planName: string;
  billingInterval: MembershipPeriod;
  planPriceId: string;
  priceVersion: number;
  currency: string;
  campaignIds: string[];
  couponId?: string;
  priceSource:
    | "PLAN_PRICE"
    | "COMPANY_OVERRIDE"
    | "GRANDFATHERED"
    | "LEGACY_PLAN_COLUMN";
  appliedDiscounts: AppliedDiscount[];
  entitlementsSnapshot: unknown;
  priceChangePolicy: SubscriptionPriceChangePolicy;
  explanation: string[];
};

export class PriceResolutionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PriceResolutionError";
    this.status = status;
  }
}

function isPriceEffective(
  price: {
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    status: PlanPriceStatus;
  },
  now: Date
) {
  if (price.status === "ACTIVE") {
    if (price.effectiveFrom > now) return false;
    if (price.effectiveUntil && price.effectiveUntil <= now) return false;
    return true;
  }
  if (price.status === "SCHEDULED" && price.effectiveFrom <= now) {
    if (price.effectiveUntil && price.effectiveUntil <= now) return false;
    return true;
  }
  return false;
}

export async function getActivePlanPrice(input: {
  planId: string;
  billingInterval: MembershipPeriod;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const prices = await db.membershipPlanPrice.findMany({
    where: {
      planId: input.planId,
      billingInterval: input.billingInterval,
      status: { in: ["ACTIVE", "SCHEDULED"] },
    },
    orderBy: [{ version: "desc" }],
  });

  const active = prices.find((price) => isPriceEffective(price, now));
  return active ?? null;
}

export async function resolveSubscriptionPrice(input: {
  companyId: string;
  planId: string;
  billingInterval: MembershipPeriod;
  couponCode?: string | null;
  partnerCode?: string | null;
  now?: Date;
  isRenewal?: boolean;
}): Promise<ResolvedSubscriptionPrice> {
  const now = input.now ?? new Date();
  const explanation: string[] = [];
  const appliedDiscounts: AppliedDiscount[] = [];

  const [plan, subscription, planPrice, companyOverride] = await Promise.all([
    db.membershipPlan.findUnique({ where: { id: input.planId } }),
    db.companySubscription.findUnique({ where: { companyId: input.companyId } }),
    getActivePlanPrice({
      planId: input.planId,
      billingInterval: input.billingInterval,
      at: now,
    }),
    db.companyPlanPriceOverride.findFirst({
      where: {
        companyId: input.companyId,
        planId: input.planId,
        billingInterval: input.billingInterval,
        status: "ACTIVE",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!plan || (!plan.isActive && plan.planStatus !== "ACTIVE")) {
    throw new PriceResolutionError("Plan bulunamadı veya aktif değil.", 404);
  }

  let listPriceMinor: number;
  let salePriceMinor: number;
  let vatRate = plan.vatRate;
  let vatIncluded = plan.vatIncluded;
  let planPriceId: string;
  let priceVersion = 1;
  let priceSource: ResolvedSubscriptionPrice["priceSource"] = "PLAN_PRICE";
  let priceChangePolicy: SubscriptionPriceChangePolicy = "NEW_SUBSCRIBERS_ONLY";

  if (
    subscription?.lockedPriceMinor != null &&
    subscription.priceLockType === "GRANDFATHERED" &&
    (subscription.priceLockedUntil == null || subscription.priceLockedUntil > now)
  ) {
    listPriceMinor =
      subscription.lockedListPriceMinor ?? subscription.lockedPriceMinor;
    salePriceMinor = subscription.lockedPriceMinor;
    planPriceId = subscription.lockedPlanPriceId ?? "grandfathered";
    priceVersion = 0;
    priceSource = "GRANDFATHERED";
    explanation.push("Abonelik fiyat koruması (grandfathered) uygulandı.");
  } else if (companyOverride) {
    listPriceMinor = companyOverride.priceMinor;
    salePriceMinor = companyOverride.priceMinor;
    vatRate = companyOverride.vatRate ?? plan.vatRate;
    vatIncluded = companyOverride.vatIncluded ?? plan.vatIncluded;
    planPriceId = companyOverride.id;
    priceSource = "COMPANY_OVERRIDE";
    explanation.push(`Firma özel fiyatı: ${companyOverride.reason}`);
    appliedDiscounts.push({
      type: "OVERRIDE",
      id: companyOverride.id,
      label: "Özel firma fiyatı",
      amountMinor: 0,
    });
  } else if (planPrice) {
    listPriceMinor = planPrice.listPriceMinor;
    salePriceMinor = planPrice.salePriceMinor;
    vatRate = planPrice.vatRate;
    vatIncluded = planPrice.vatIncluded;
    planPriceId = planPrice.id;
    priceVersion = planPrice.version;
    priceChangePolicy = planPrice.priceChangePolicy;
    explanation.push(`Plan fiyatı v${planPrice.version} (${planPrice.status})`);

    if (planPrice.listPriceMinor > planPrice.salePriceMinor) {
      appliedDiscounts.push({
        type: "PLAN",
        id: planPrice.id,
        label: "Dönem indirimi",
        amountMinor: planPrice.listPriceMinor - planPrice.salePriceMinor,
      });
    }
  } else {
    const legacyAmount = legacyPlanAmount(plan, input.billingInterval);
    const minor = Math.round(legacyAmount * 100);
    listPriceMinor = minor;
    salePriceMinor = minor;
    planPriceId = `legacy-${plan.id}-${input.billingInterval}`;
    priceSource = "LEGACY_PLAN_COLUMN";
    explanation.push("Legacy plan kolon fiyatı kullanıldı (geçiş).");
  }

  const blockCampaigns =
    priceSource === "GRANDFATHERED" || priceSource === "COMPANY_OVERRIDE";
  const blockCoupons = blockCampaigns;

  const paidPayments = await db.membershipPayment.count({
    where: {
      companyId: input.companyId,
      status: "PAID",
      provider: { not: "TRIAL" },
    },
  });
  const isNewCustomer = paidPayments === 0;

  const partnerConversion = await db.partnerConversion.findFirst({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "desc" },
    select: { partnerId: true },
  });

  const campaignResult = await resolveCampaignDiscounts({
    companyId: input.companyId,
    planId: input.planId,
    billingInterval: input.billingInterval,
    isRenewal: input.isRenewal,
    isNewCustomer,
    now,
    listPriceMinor,
    salePriceMinor,
    blockCampaigns,
    partnerId: partnerConversion?.partnerId ?? null,
  });

  salePriceMinor = campaignResult.salePriceMinor;
  const campaignIds = campaignResult.campaignIds;
  appliedDiscounts.push(...campaignResult.appliedDiscounts);
  explanation.push(...campaignResult.explanation);

  const campaignDiscountMinor = campaignResult.appliedDiscounts.reduce(
    (sum, item) => sum + item.amountMinor,
    0
  );

  const couponResult = await resolveCouponDiscount({
    companyId: input.companyId,
    planId: input.planId,
    billingInterval: input.billingInterval,
    couponCode: input.couponCode,
    isRenewal: input.isRenewal,
    isNewCustomer,
    now,
    listPriceMinor,
    salePriceMinor,
    blockCoupons,
    campaignDiscountMinor,
    partnerId: partnerConversion?.partnerId ?? null,
  });

  salePriceMinor = couponResult.salePriceMinor;
  const couponId = couponResult.couponId;
  appliedDiscounts.push(...couponResult.appliedDiscounts);
  explanation.push(...couponResult.explanation);

  const totals = buildPriceTotals({
    listPriceMinor,
    salePriceMinor,
    interval: input.billingInterval,
    vatRate,
    vatIncluded,
  });

  const entitlements = await db.planEntitlement.findMany({
    where: { planId: input.planId },
    orderBy: { sortOrder: "asc" },
  });

  const entitlementsSnapshot =
    entitlements.length > 0
      ? entitlements
      : plan.features.map((feature) => ({ code: feature, valueType: "BOOLEAN" }));

  return {
    ...totals,
    planId: plan.id,
    planName: plan.name,
    billingInterval: input.billingInterval,
    planPriceId,
    priceVersion,
    currency: plan.defaultCurrency || plan.currency,
    campaignIds,
    couponId,
    priceSource,
    appliedDiscounts,
    entitlementsSnapshot,
    priceChangePolicy,
    explanation,
  };
}

function legacyPlanAmount(
  plan: {
    monthlyPrice: { toString(): string };
    quarterlyPrice: { toString(): string };
    semiAnnualPrice: { toString(): string };
    yearlyPrice: { toString(): string };
  },
  interval: MembershipPeriod
) {
  switch (interval) {
    case "QUARTERLY":
      return Number(plan.quarterlyPrice);
    case "SEMI_ANNUAL":
      return Number(plan.semiAnnualPrice);
    case "YEARLY":
      return Number(plan.yearlyPrice);
    default:
      return Number(plan.monthlyPrice);
  }
}
