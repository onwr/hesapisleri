import "server-only";

import type { DiscountType, MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AppliedDiscount } from "@/lib/billing/price-resolution-service";
import { PriceResolutionError } from "@/lib/billing/price-resolution-service";
import { countActiveRedemptions } from "@/lib/billing/discount-reservation-service";
import { normalizeCouponCode } from "@/lib/admin/promotions/coupon-utils";

export type DiscountResolutionInput = {
  companyId: string;
  planId: string;
  billingInterval: MembershipPeriod;
  couponCode?: string | null;
  isRenewal?: boolean;
  isNewCustomer?: boolean;
  now?: Date;
  listPriceMinor: number;
  salePriceMinor: number;
  blockCampaigns?: boolean;
  blockCoupons?: boolean;
  partnerId?: string | null;
};

export type DiscountResolutionResult = {
  salePriceMinor: number;
  campaignIds: string[];
  couponId?: string;
  appliedDiscounts: AppliedDiscount[];
  explanation: string[];
};

function applyDiscountAmount(
  discountType: DiscountType,
  discountValue: number,
  salePriceMinor: number,
  listPriceMinor: number
) {
  if (discountType === "PERCENTAGE") {
    return Math.round((salePriceMinor * discountValue) / 100);
  }
  if (discountType === "FIXED_AMOUNT") {
    return Math.min(discountValue, salePriceMinor);
  }
  return Math.max(0, salePriceMinor - discountValue);
}

async function campaignInScope(
  scope: {
    planId: string | null;
    billingInterval: MembershipPeriod | null;
    companyId: string | null;
    partnerId: string | null;
    firstPaymentOnly: boolean;
    renewalAllowed: boolean;
  },
  input: DiscountResolutionInput
) {
  if (scope.planId && scope.planId !== input.planId) return false;
  if (scope.billingInterval && scope.billingInterval !== input.billingInterval) {
    return false;
  }
  if (scope.companyId && scope.companyId !== input.companyId) return false;
  if (scope.partnerId && scope.partnerId !== input.partnerId) return false;
  if (input.isRenewal && !scope.renewalAllowed) return false;
  if (!input.isRenewal && scope.firstPaymentOnly === false && scope.planId == null) {
    return true;
  }
  if (!input.isRenewal && scope.firstPaymentOnly) return true;
  if (input.isRenewal) return scope.renewalAllowed;
  return true;
}

export async function resolveCampaignDiscounts(
  input: DiscountResolutionInput
): Promise<DiscountResolutionResult> {
  const now = input.now ?? new Date();
  const explanation: string[] = [];
  const appliedDiscounts: AppliedDiscount[] = [];
  const campaignIds: string[] = [];
  let salePriceMinor = input.salePriceMinor;

  if (input.blockCampaigns) {
    return {
      salePriceMinor,
      campaignIds,
      appliedDiscounts,
      explanation,
    };
  }

  const campaigns = await db.membershipCampaign.findMany({
    where: {
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      autoApply: true,
    },
    include: { scopes: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  let totalCampaignDiscount = 0;

  for (const campaign of campaigns) {
    if (campaign.newCustomersOnly && !input.isNewCustomer) continue;
    if (!campaign.existingCustomersAllowed && input.isNewCustomer) continue;
    if (input.isRenewal && !campaign.renewalAllowed) continue;
    if (!input.isRenewal && campaign.firstPaymentOnly === false && campaign.scopes.every((s) => !s.firstPaymentOnly)) {
      // allow
    } else if (!input.isRenewal && campaign.firstPaymentOnly && input.isRenewal) {
      continue;
    }

    const scopes = campaign.scopes.length
      ? campaign.scopes
      : [
          {
            planId: null,
            billingInterval: null,
            companyId: null,
            partnerId: null,
            firstPaymentOnly: campaign.firstPaymentOnly,
            renewalAllowed: campaign.renewalAllowed,
          },
        ];

    const inScope = scopes.some((scope) => campaignInScope(scope, input));
    if (!inScope) continue;

    if (campaign.minimumAmountMinor && salePriceMinor < campaign.minimumAmountMinor) {
      continue;
    }

    if (campaign.maxRedemptions != null) {
      const used = await countActiveRedemptions({ campaignId: campaign.id });
      if (used >= campaign.maxRedemptions) continue;
    }

    if (campaign.maxRedemptionsPerCompany != null) {
      const used = await countActiveRedemptions({
        campaignId: campaign.id,
        companyId: input.companyId,
      });
      if (used >= campaign.maxRedemptionsPerCompany) continue;
    }

    let amount = applyDiscountAmount(
      campaign.discountType,
      campaign.discountValue,
      salePriceMinor,
      input.listPriceMinor
    );

    if (campaign.discountType === "OVERRIDE_PRICE") {
      const overrideMinor = campaign.overridePriceMinor ?? campaign.discountValue;
      salePriceMinor = overrideMinor;
      amount = Math.max(0, input.listPriceMinor - overrideMinor);
    }

    if (amount <= 0 && campaign.discountType !== "OVERRIDE_PRICE") continue;

    if (!campaign.stackable && totalCampaignDiscount > 0) break;

    totalCampaignDiscount += amount;
    campaignIds.push(campaign.id);
    appliedDiscounts.push({
      type: "CAMPAIGN",
      id: campaign.id,
      code: campaign.code ?? undefined,
      label: campaign.name,
      amountMinor: amount,
    });
    explanation.push(`Kampanya: ${campaign.name}`);

    if (campaign.discountType !== "OVERRIDE_PRICE") {
      salePriceMinor = Math.max(0, salePriceMinor - amount);
    }
  }

  return { salePriceMinor, campaignIds, appliedDiscounts, explanation };
}

export async function resolveCouponDiscount(
  input: DiscountResolutionInput & { campaignDiscountMinor: number }
): Promise<DiscountResolutionResult> {
  const now = input.now ?? new Date();
  const explanation: string[] = [];
  const appliedDiscounts: AppliedDiscount[] = [];
  let salePriceMinor = input.salePriceMinor;
  let couponId: string | undefined;

  if (input.blockCoupons || !input.couponCode?.trim()) {
    return {
      salePriceMinor,
      campaignIds: [],
      couponId,
      appliedDiscounts,
      explanation,
    };
  }

  const normalized = normalizeCouponCode(input.couponCode);
  const coupon = await db.membershipCoupon.findFirst({
    where: {
      code: normalized,
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: { planScopes: true },
  });

  if (!coupon) {
    throw new PriceResolutionError("Kupon kodu geçersiz veya süresi dolmuş.");
  }

  if (
    coupon.allowedIntervals.length > 0 &&
    !coupon.allowedIntervals.includes(input.billingInterval)
  ) {
    throw new PriceResolutionError("Kupon bu dönem için geçerli değil.");
  }

  if (
    coupon.planScopes.length > 0 &&
    !coupon.planScopes.some((scope) => scope.planId === input.planId)
  ) {
    throw new PriceResolutionError("Kupon bu plan için geçerli değil.");
  }

  if (input.isRenewal && coupon.firstPaymentOnly && !coupon.renewalAllowed) {
    throw new PriceResolutionError("Kupon yalnızca ilk ödemede kullanılabilir.");
  }

  if (coupon.newCustomersOnly && !input.isNewCustomer) {
    throw new PriceResolutionError("Kupon yalnızca yeni müşteriler için geçerlidir.");
  }

  if (coupon.minimumAmountMinor && salePriceMinor < coupon.minimumAmountMinor) {
    throw new PriceResolutionError("Minimum tutar şartı sağlanmıyor.");
  }

  if (coupon.maxUsage != null) {
    const used = await countActiveRedemptions({ couponId: coupon.id });
    if (used >= coupon.maxUsage) {
      throw new PriceResolutionError("Kupon kullanım limiti dolmuş.");
    }
  }

  const companyUsed = await countActiveRedemptions({
    couponId: coupon.id,
    companyId: input.companyId,
  });
  if (companyUsed >= coupon.maxUsagePerCompany) {
    throw new PriceResolutionError("Bu firma için kupon kullanım limiti dolmuş.");
  }

  if (!coupon.stackable && input.campaignDiscountMinor > 0) {
    throw new PriceResolutionError(
      "Kupon, mevcut kampanya ile birlikte kullanılamaz."
    );
  }

  let couponDiscount = applyDiscountAmount(
    coupon.discountType,
    coupon.discountValue,
    salePriceMinor,
    input.listPriceMinor
  );

  if (coupon.discountType === "OVERRIDE_PRICE") {
    const overrideMinor = coupon.overridePriceMinor ?? coupon.discountValue;
    salePriceMinor = overrideMinor;
    couponDiscount = Math.max(0, input.listPriceMinor - overrideMinor);
  } else {
    salePriceMinor = Math.max(0, salePriceMinor - couponDiscount);
  }

  couponId = coupon.id;
  appliedDiscounts.push({
    type: "COUPON",
    id: coupon.id,
    code: coupon.code,
    label: coupon.name,
    amountMinor: couponDiscount,
  });
  explanation.push(`Kupon: ${coupon.code}`);

  return {
    salePriceMinor,
    campaignIds: [],
    couponId,
    appliedDiscounts,
    explanation,
  };
}
