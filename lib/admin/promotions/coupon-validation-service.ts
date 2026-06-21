import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import { PriceResolutionError } from "@/lib/billing/price-resolution-service";
import { normalizeCouponCode } from "@/lib/admin/promotions/coupon-utils";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";

export async function validateCouponForCompany(input: {
  companyId: string;
  code: string;
  planId: string;
  billingInterval: MembershipPeriod;
  isRenewal?: boolean;
}) {
  const normalizedCode = normalizeCouponCode(input.code);

  try {
    const price = await resolveSubscriptionPrice({
      companyId: input.companyId,
      planId: input.planId,
      billingInterval: input.billingInterval,
      couponCode: normalizedCode,
      isRenewal: input.isRenewal,
    });

    const couponDiscount = price.appliedDiscounts
      .filter((d) => d.type === "COUPON")
      .reduce((sum, d) => sum + d.amountMinor, 0);

    return {
      valid: true,
      normalizedCode,
      discountMinor: couponDiscount,
      pricePreview: {
        listPriceMinor: price.listPriceMinor,
        totalMinor: price.totalMinor,
        totalFormatted: formatMinorToMoney(price.totalMinor),
        vatMinor: price.vatMinor,
        monthlyEquivalentMinor: price.monthlyEquivalentMinor,
        appliedDiscounts: price.appliedDiscounts,
        explanation: price.explanation,
      },
    };
  } catch (error) {
    return {
      valid: false,
      normalizedCode,
      reason:
        error instanceof PriceResolutionError
          ? error.message
          : "Kupon doğrulanamadı.",
    };
  }
}

export async function previewPromotionPrice(input: {
  companyId: string;
  planId: string;
  billingInterval: MembershipPeriod;
  couponCode?: string | null;
  isRenewal?: boolean;
}) {
  const price = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId: input.planId,
    billingInterval: input.billingInterval,
    couponCode: input.couponCode,
    isRenewal: input.isRenewal,
  });

  return {
    ...price,
    totalFormatted: formatMinorToMoney(price.totalMinor),
    listFormatted: formatMinorToMoney(price.listPriceMinor),
  };
}
