import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import {
  resolveSubscriptionPrice,
  PriceResolutionError,
} from "@/lib/billing/price-resolution-service";
import { buildPriceTotals } from "@/lib/billing/pricing-utils";
import { countActiveRedemptions } from "@/lib/billing/discount-reservation-service";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";

function applyDiscountAmount(
  discountType: string,
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

function scopeMatches(
  scope: {
    planId: string | null;
    billingInterval: MembershipPeriod | null;
    companyId: string | null;
    partnerId: string | null;
    firstPaymentOnly: boolean;
    renewalAllowed: boolean;
  },
  input: {
    planId: string;
    billingInterval: MembershipPeriod;
    companyId: string;
    isRenewal?: boolean;
    partnerId?: string | null;
  }
) {
  if (scope.planId && scope.planId !== input.planId) return false;
  if (scope.billingInterval && scope.billingInterval !== input.billingInterval) return false;
  if (scope.companyId && scope.companyId !== input.companyId) return false;
  if (scope.partnerId && scope.partnerId !== input.partnerId) return false;
  if (input.isRenewal && !scope.renewalAllowed) return false;
  if (!input.isRenewal && scope.firstPaymentOnly) return true;
  if (input.isRenewal) return scope.renewalAllowed;
  return true;
}

export async function previewCampaignPrice(
  campaignId: string,
  input: {
    companyId: string;
    planId: string;
    billingInterval: MembershipPeriod;
    isRenewal?: boolean;
  }
) {
  const campaign = await db.membershipCampaign.findUnique({
    where: { id: campaignId },
    include: { scopes: true },
  });
  if (!campaign) throw new PromotionError("Kampanya bulunamadı.", 404);

  const ineligibleReasons: string[] = [];
  const now = new Date();

  if (campaign.status === "ARCHIVED") {
    ineligibleReasons.push("Kampanya arşivlenmiş.");
  }
  if (campaign.endsAt && campaign.endsAt <= now) {
    ineligibleReasons.push("Kampanya süresi dolmuş.");
  }
  if (campaign.startsAt > now && campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    ineligibleReasons.push("Kampanya henüz başlamamış.");
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

  const partnerConversion = await db.partnerConversion.findFirst({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "desc" },
    select: { partnerId: true },
  });

  const inScope = scopes.some((scope) =>
    scopeMatches(scope, {
      ...input,
      partnerId: partnerConversion?.partnerId ?? null,
    })
  );
  if (!inScope) ineligibleReasons.push("Kampanya bu plan/dönem kapsamında değil.");

  const paidPayments = await db.membershipPayment.count({
    where: {
      companyId: input.companyId,
      status: "PAID",
      provider: { not: "TRIAL" },
    },
  });
  const isNewCustomer = paidPayments === 0;
  if (campaign.newCustomersOnly && !isNewCustomer) {
    ineligibleReasons.push("Kampanya yalnızca yeni müşteriler için.");
  }
  if (!campaign.existingCustomersAllowed && isNewCustomer) {
    ineligibleReasons.push("Kampanya mevcut müşteriler için kapalı.");
  }
  if (input.isRenewal && !campaign.renewalAllowed) {
    ineligibleReasons.push("Kampanya yenileme ödemelerinde geçerli değil.");
  }

  let stackedPrice;
  try {
    stackedPrice = await resolveSubscriptionPrice({
      companyId: input.companyId,
      planId: input.planId,
      billingInterval: input.billingInterval,
      isRenewal: input.isRenewal,
    });
  } catch (error) {
    const reason =
      error instanceof PriceResolutionError ? error.message : "Fiyat çözümlenemedi.";
    ineligibleReasons.push(reason);
    return {
      eligible: false,
      ineligibleReasons,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        priority: campaign.priority,
        stackable: campaign.stackable,
        discountType: campaign.discountType,
        currency: campaign.currency,
        startsAt: campaign.startsAt.toISOString(),
        endsAt: campaign.endsAt?.toISOString() ?? null,
      },
    };
  }

  if (stackedPrice.currency !== campaign.currency) {
    ineligibleReasons.push(
      `Kampanya para birimi (${campaign.currency}) fiyat para birimi (${stackedPrice.currency}) ile uyumsuz.`
    );
  }

  const preCampaignSaleMinor =
    stackedPrice.salePriceMinor +
    stackedPrice.appliedDiscounts
      .filter((d) => d.type === "CAMPAIGN")
      .reduce((s, d) => s + d.amountMinor, 0);

  if (campaign.minimumAmountMinor && preCampaignSaleMinor < campaign.minimumAmountMinor) {
    ineligibleReasons.push("Minimum tutar şartı sağlanmıyor.");
  }

  if (campaign.maxRedemptions != null) {
    const used = await countActiveRedemptions({ campaignId: campaign.id });
    if (used >= campaign.maxRedemptions) {
      ineligibleReasons.push("Kampanya genel kullanım limiti dolmuş.");
    }
  }
  if (campaign.maxRedemptionsPerCompany != null) {
    const used = await countActiveRedemptions({
      campaignId: campaign.id,
      companyId: input.companyId,
    });
    if (used >= campaign.maxRedemptionsPerCompany) {
      ineligibleReasons.push("Bu firma için kullanım limiti dolmuş.");
    }
  }

  let campaignDiscountMinor = applyDiscountAmount(
    campaign.discountType,
    campaign.discountValue,
    preCampaignSaleMinor,
    stackedPrice.listPriceMinor
  );

  let finalSaleMinor = preCampaignSaleMinor;
  if (campaign.discountType === "OVERRIDE_PRICE") {
    const overrideMinor = campaign.overridePriceMinor ?? campaign.discountValue;
    finalSaleMinor = overrideMinor;
    campaignDiscountMinor = Math.max(0, stackedPrice.listPriceMinor - overrideMinor);
  } else {
    finalSaleMinor = Math.max(0, preCampaignSaleMinor - campaignDiscountMinor);
  }

  if (finalSaleMinor < 0) {
    ineligibleReasons.push("Final fiyat negatif olamaz.");
    finalSaleMinor = 0;
  }

  const simulatedTotals = buildPriceTotals({
    listPriceMinor: stackedPrice.listPriceMinor,
    salePriceMinor: finalSaleMinor,
    interval: input.billingInterval,
    vatRate: stackedPrice.vatRate,
    vatIncluded: stackedPrice.vatIncluded,
  });

  const otherCampaignDiscount = stackedPrice.appliedDiscounts
    .filter((d) => d.type === "CAMPAIGN" && d.id !== campaign.id)
    .reduce((s, d) => s + d.amountMinor, 0);

  if (!campaign.stackable && otherCampaignDiscount > 0 && campaign.autoApply) {
    ineligibleReasons.push("Diğer otomatik kampanyalarla birleştirilemez (stackable=false).");
  }

  return {
    eligible: ineligibleReasons.length === 0,
    ineligibleReasons,
    planId: input.planId,
    planName: stackedPrice.planName,
    billingInterval: input.billingInterval,
    currency: stackedPrice.currency,
    listPriceMinor: stackedPrice.listPriceMinor,
    currentSalePriceMinor: stackedPrice.salePriceMinor,
    preCampaignSaleMinor,
    campaignDiscountMinor,
    finalSaleMinor,
    vatMinor: simulatedTotals.vatMinor,
    totalMinor: simulatedTotals.totalMinor,
    totalFormatted: formatMinorToMoney(simulatedTotals.totalMinor),
    listFormatted: formatMinorToMoney(stackedPrice.listPriceMinor),
    stacking: {
      otherActiveCampaignDiscountMinor: otherCampaignDiscount,
      resolvedCampaignIds: stackedPrice.campaignIds,
      couponApplied: Boolean(stackedPrice.couponId),
    },
    campaign: {
      id: campaign.id,
      name: campaign.name,
      priority: campaign.priority,
      stackable: campaign.stackable,
      autoApply: campaign.autoApply,
      discountType: campaign.discountType,
      discountValue: campaign.discountValue,
      currency: campaign.currency,
      startsAt: campaign.startsAt.toISOString(),
      endsAt: campaign.endsAt?.toISOString() ?? null,
    },
    appliedDiscounts: stackedPrice.appliedDiscounts,
    explanation: stackedPrice.explanation,
  };
}
