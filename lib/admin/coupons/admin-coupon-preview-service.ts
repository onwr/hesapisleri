import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PromotionError } from "@/lib/admin/promotions/promotion-errors";
import {
  resolveSubscriptionPrice,
  PriceResolutionError,
} from "@/lib/billing/price-resolution-service";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";

export async function previewCouponPrice(
  couponId: string,
  input: {
    companyId: string;
    planId: string;
    billingInterval: MembershipPeriod;
    isRenewal?: boolean;
  }
) {
  const coupon = await db.membershipCoupon.findUnique({
    where: { id: couponId },
    include: { planScopes: true },
  });
  if (!coupon) throw new PromotionError("Kupon bulunamadı.", 404);

  const ineligibleReasons: string[] = [];
  const now = new Date();

  if (coupon.status === "ARCHIVED") ineligibleReasons.push("Kupon arşivlenmiş.");
  if (coupon.status === "DRAFT" || coupon.status === "PAUSED") {
    ineligibleReasons.push("Kupon aktif değil.");
  }
  if (coupon.expiresAt && coupon.expiresAt <= now) {
    ineligibleReasons.push("Kupon süresi dolmuş.");
  }
  if (coupon.startsAt > now) ineligibleReasons.push("Kupon henüz başlamamış.");

  if (
    coupon.planScopes.length > 0 &&
    !coupon.planScopes.some((s) => s.planId === input.planId)
  ) {
    ineligibleReasons.push("Kupon bu plan için geçerli değil.");
  }

  if (
    coupon.allowedIntervals.length > 0 &&
    !coupon.allowedIntervals.includes(input.billingInterval)
  ) {
    ineligibleReasons.push("Kupon bu dönem için geçerli değil.");
  }

  if (input.isRenewal && coupon.firstPaymentOnly && !coupon.renewalAllowed) {
    ineligibleReasons.push("Kupon yalnızca ilk ödemede kullanılabilir.");
  }

  let resolved;
  try {
    resolved = await resolveSubscriptionPrice({
      companyId: input.companyId,
      planId: input.planId,
      billingInterval: input.billingInterval,
      couponCode: coupon.code,
      isRenewal: input.isRenewal,
    });
  } catch (error) {
    const reason =
      error instanceof PriceResolutionError ? error.message : "Fiyat çözümlenemedi.";
    ineligibleReasons.push(reason);
    return {
      eligible: false,
      ineligibleReasons,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        stackable: coupon.stackable,
        discountType: coupon.discountType,
        currency: coupon.currency,
      },
    };
  }

  if (resolved.currency !== coupon.currency) {
    ineligibleReasons.push(
      `Kupon para birimi (${coupon.currency}) fiyat para birimi (${resolved.currency}) ile uyumsuz.`
    );
  }

  const campaignDiscountMinor = resolved.appliedDiscounts
    .filter((d) => d.type === "CAMPAIGN")
    .reduce((s, d) => s + d.amountMinor, 0);
  const couponDiscountMinor = resolved.appliedDiscounts
    .filter((d) => d.type === "COUPON")
    .reduce((s, d) => s + d.amountMinor, 0);

  if (!coupon.stackable && campaignDiscountMinor > 0 && couponDiscountMinor === 0) {
    ineligibleReasons.push("Kupon mevcut kampanyalarla birleştirilemez (stackable=false).");
  }

  if (resolved.totalMinor < 0) {
    ineligibleReasons.push("Final fiyat negatif olamaz.");
  }

  const preCouponSale =
    resolved.salePriceMinor +
    couponDiscountMinor +
    campaignDiscountMinor -
    (resolved.appliedDiscounts.find((d) => d.type === "PLAN")?.amountMinor ?? 0);

  return {
    eligible: ineligibleReasons.length === 0 && couponDiscountMinor > 0,
    ineligibleReasons,
    planId: input.planId,
    planName: resolved.planName,
    billingInterval: input.billingInterval,
    currency: resolved.currency,
    listPriceMinor: resolved.listPriceMinor,
    salePriceMinor: resolved.salePriceMinor,
    campaignDiscountMinor,
    couponDiscountMinor,
    totalMinor: resolved.totalMinor,
    vatMinor: resolved.vatMinor,
    totalFormatted: formatMinorToMoney(resolved.totalMinor),
    listFormatted: formatMinorToMoney(resolved.listPriceMinor),
    stacking: {
      campaignIds: resolved.campaignIds,
      stackable: coupon.stackable,
      campaignApplied: campaignDiscountMinor > 0,
      couponApplied: couponDiscountMinor > 0,
    },
    coupon: {
      id: coupon.id,
      code: coupon.code,
      stackable: coupon.stackable,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      currency: coupon.currency,
      startsAt: coupon.startsAt.toISOString(),
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
    },
    appliedDiscounts: resolved.appliedDiscounts,
    explanation: resolved.explanation,
    preCouponSaleMinor: Math.max(0, preCouponSale),
  };
}
