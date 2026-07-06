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

import {
  assertSingleEffectivePrice,
  PriceResolutionConflictError,
} from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { getPlanFeaturesForDisplay } from "@/lib/admin/plans/admin-plan-feature-service";

export { PriceResolutionConflictError };

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
  currency?: string;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const plan = await db.membershipPlan.findUnique({
    where: { id: input.planId },
    select: { defaultCurrency: true, currency: true },
  });
  const currency = input.currency ?? plan?.defaultCurrency ?? plan?.currency ?? "TRY";

  const prices = await db.membershipPlanPrice.findMany({
    where: {
      planId: input.planId,
      billingInterval: input.billingInterval,
      currency,
      status: { in: ["ACTIVE", "SCHEDULED"] },
    },
    orderBy: [{ version: "desc" }],
  });

  return assertSingleEffectivePrice(prices, input.billingInterval, currency, now);
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
    db.companySubscription.findUnique({
      where: { companyId: input.companyId },
      include: {
        lockedPlanPrice: {
          select: {
            id: true,
            billingInterval: true,
            vatRate: true,
            vatIncluded: true,
          },
        },
      },
    }),
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

  if (!plan || plan.planStatus !== "ACTIVE") {
    throw new PriceResolutionError("Plan bulunamadı veya aktif değil.", 404);
  }

  const currency = plan.defaultCurrency || plan.currency;

  let listPriceMinor: number;
  let salePriceMinor: number;
  let vatRate = plan.vatRate;
  let vatIncluded = plan.vatIncluded;
  let planPriceId: string;
  let priceVersion = 1;
  let priceSource: ResolvedSubscriptionPrice["priceSource"] = "PLAN_PRICE";
  let priceChangePolicy: SubscriptionPriceChangePolicy = "NEW_SUBSCRIBERS_ONLY";

  const useLockedPrice =
    subscription?.lockedPriceMinor != null &&
    subscription.lockedPlanPriceId != null &&
    subscription.lockedPlanPrice?.billingInterval === input.billingInterval &&
    (subscription.priceLockType === "GRANDFATHERED" ||
      subscription.priceLockType === "NEW_SUBSCRIBERS_ONLY" ||
      (subscription.nextPriceEffectiveAt != null && now < subscription.nextPriceEffectiveAt));

  const scheduledNextPrice =
    subscription?.nextPlanPriceId &&
    subscription.nextPriceEffectiveAt &&
    now >= subscription.nextPriceEffectiveAt
      ? await db.membershipPlanPrice.findUnique({
          where: { id: subscription.nextPlanPriceId },
        })
      : null;

  if (useLockedPrice && subscription) {
    listPriceMinor =
      subscription.lockedListPriceMinor ?? subscription.lockedPriceMinor!;
    salePriceMinor = subscription.lockedPriceMinor!;
    planPriceId = subscription.lockedPlanPriceId!;
    priceVersion = 0;
    priceSource =
      subscription.priceLockType === "GRANDFATHERED" ? "GRANDFATHERED" : "GRANDFATHERED";
    priceChangePolicy = subscription.priceLockType ?? "NEW_SUBSCRIBERS_ONLY";
    explanation.push(
      subscription.priceLockType === "GRANDFATHERED"
        ? "Abonelik fiyat koruması (grandfathered) uygulandı."
        : "Mevcut abonelik kilitli fiyatla devam ediyor."
    );
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
  } else if (scheduledNextPrice) {
    listPriceMinor = scheduledNextPrice.listPriceMinor;
    salePriceMinor = scheduledNextPrice.salePriceMinor;
    vatRate = scheduledNextPrice.vatRate;
    vatIncluded = scheduledNextPrice.vatIncluded;
    planPriceId = scheduledNextPrice.id;
    priceVersion = scheduledNextPrice.version;
    priceChangePolicy = scheduledNextPrice.priceChangePolicy;
    explanation.push(
      `Planlanmış fiyat geçişi uygulandı (v${scheduledNextPrice.version}).`
    );
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
    const legacyAmount = legacyPlanAmount(plan, input.billingInterval, currency);
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

  const featureLabels = await getPlanFeaturesForDisplay(input.planId);
  const entitlementsSnapshot =
    entitlements.length > 0
      ? entitlements
      : featureLabels.map((feature) => ({ code: feature, valueType: "BOOLEAN" }));

  return {
    ...totals,
    planId: plan.id,
    planName: plan.name,
    billingInterval: input.billingInterval,
    planPriceId,
    priceVersion,
    currency,
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
    defaultCurrency: string;
    currency: string;
    monthlyPrice: { toString(): string };
    quarterlyPrice: { toString(): string };
    semiAnnualPrice: { toString(): string };
    yearlyPrice: { toString(): string };
  },
  interval: MembershipPeriod,
  requestedCurrency: string
) {
  const defaultCurrency = plan.defaultCurrency || plan.currency;
  if (requestedCurrency !== defaultCurrency) {
    throw new PriceResolutionError(
      `Legacy fiyat yalnızca ${defaultCurrency} için mevcut.`,
      404
    );
  }
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
