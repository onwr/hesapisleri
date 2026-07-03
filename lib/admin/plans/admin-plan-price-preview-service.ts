import "server-only";

import type { MembershipPeriod, SubscriptionPriceChangePolicy } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildPriceTotals, parseMoneyToMinor } from "@/lib/billing/pricing-utils";
import { getActivePlanPrice } from "@/lib/billing/price-resolution-service";
import { ACTIVE_SUB_STATUSES } from "@/lib/admin/plans/admin-plan-issue-service";
import { validatePriceOverlap } from "@/lib/admin/plans/admin-plan-price-publish-service";
import {
  applyPriceChangePolicyOnPublish,
  expirePreviousActivePrices,
  syncLegacyPlanColumnIfApplicable,
} from "@/lib/admin/plans/admin-plan-price-publish-service";
import { MembershipPlanPriceError } from "@/lib/membership-plan-price-service";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import {
  PreviewStaleError,
  PLAN_PRICE_PREVIEW_TTL_MS,
  type AffectedSubscriptionSummary,
  type PlanPricePreviewCanonicalPayload,
} from "@/lib/admin/plans/admin-plan-preview-hash";
import { getPricePolicyLabel } from "@/lib/admin/plans/admin-plan-price-policy-labels";
import { policyAffectsExistingSubscribersNow } from "@/lib/admin/plans/admin-plan-price-policy-utils";
import { invalidateAdminPlanCaches } from "@/lib/admin/plans/admin-plan-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import type { z } from "zod";
import type { adminPlanPricePreviewInputSchema } from "@/lib/admin/plans/admin-plan-schemas";

export { PreviewStaleError };

type PreviewInput = z.infer<typeof adminPlanPricePreviewInputSchema>;

function resolveMinor(listPrice: string | number, listPriceMinor?: number) {
  if (listPriceMinor != null) return listPriceMinor;
  return parseMoneyToMinor(listPrice);
}

async function loadSubscriptionImpact(planId: string, billingInterval: MembershipPeriod) {
  const subs = await db.companySubscription.findMany({
    where: {
      planId,
      billingInterval,
      status: { in: [...ACTIVE_SUB_STATUSES] },
    },
    select: {
      id: true,
      lockedPlanPriceId: true,
      lockedPriceMinor: true,
      priceLockType: true,
      nextPlanPriceId: true,
    },
  });

  const pendingPlanChanges = await db.subscriptionPendingChange.count({
    where: { status: "PENDING", targetPlanId: planId },
  });

  const summary: AffectedSubscriptionSummary = {
    activeTotal: subs.length,
    withPriceLock: subs.filter((s) => s.lockedPlanPriceId).length,
    withoutPriceLock: subs.filter((s) => !s.lockedPlanPriceId).length,
    nextRenewalPlanned: subs.filter((s) => s.nextPlanPriceId).length,
    grandfathered: subs.filter((s) => s.priceLockType === "GRANDFATHERED").length,
    pendingPlanChanges,
  };

  return { subs, summary };
}

async function buildCanonicalPayload(
  planId: string,
  input: PreviewInput,
  userId: string,
  now: Date
): Promise<{
  canonical: PlanPricePreviewCanonicalPayload;
  currentPrice: Awaited<ReturnType<typeof getActivePlanPrice>>;
  totals: ReturnType<typeof buildPriceTotals>;
  summary: AffectedSubscriptionSummary;
}> {
  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);

  if (plan.planStatus === "ARCHIVED" && input.isPublic) {
    throw new MembershipPlanPriceError("Arşivli plana public fiyat yayınlanamaz.", 400);
  }

  const listPriceMinor = resolveMinor(input.listPrice, input.listPriceMinor);
  const salePriceMinor = resolveMinor(input.salePrice, input.salePriceMinor);

  if (listPriceMinor < 0 || salePriceMinor < 0) {
    throw new MembershipPlanPriceError("Negatif fiyat girilemez.", 400);
  }

  if (input.salePriceMinor != null && input.salePriceMinor > listPriceMinor) {
    throw new MembershipPlanPriceError("Satış fiyatı liste fiyatından yüksek olamaz.", 400);
  }

  const effectiveFrom = new Date(input.effectiveFrom);
  const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
  if (effectiveUntil && effectiveUntil <= effectiveFrom) {
    throw new MembershipPlanPriceError("effectiveUntil, effectiveFrom sonrası olmalı.", 400);
  }

  const currency = input.currency ?? (plan.defaultCurrency || plan.currency);
  const vatRate = input.vatRate ?? plan.vatRate;
  const vatIncluded = input.vatIncluded ?? plan.vatIncluded;

  await validatePriceOverlap({
    planId,
    billingInterval: input.billingInterval,
    currency,
    effectiveFrom,
    effectiveUntil,
  });

  const currentPrice = await getActivePlanPrice({
    planId,
    billingInterval: input.billingInterval,
    currency,
    at: now,
  });

  const totals = buildPriceTotals({
    listPriceMinor,
    salePriceMinor,
    interval: input.billingInterval,
    vatRate,
    vatIncluded,
  });

  const { summary } = await loadSubscriptionImpact(planId, input.billingInterval);

  const issuedAt = now.getTime();
  const canonical: PlanPricePreviewCanonicalPayload = {
    planId,
    currentPriceId: currentPrice?.id ?? null,
    billingInterval: input.billingInterval,
    currency,
    listPriceMinor: totals.listPriceMinor,
    salePriceMinor: totals.salePriceMinor,
    vatRate,
    vatIncluded,
    effectiveFrom: effectiveFrom.toISOString(),
    effectiveUntil: effectiveUntil?.toISOString() ?? null,
    priceChangePolicy: input.priceChangePolicy,
    isPublic: input.isPublic,
    affectedSubscriptionSummary: summary,
    issuedByUserId: userId,
    issuedAt,
    expiresAt: issuedAt + PLAN_PRICE_PREVIEW_TTL_MS,
  };

  return { canonical, currentPrice, totals, summary };
}

export async function createAdminPlanPricePreview(
  planId: string,
  input: PreviewInput,
  userId: string
) {
  const now = new Date();
  const { canonical, currentPrice, totals, summary } = await buildCanonicalPayload(
    planId,
    input,
    userId,
    now
  );

  const diffMinor = totals.salePriceMinor - (currentPrice?.salePriceMinor ?? 0);
  const diffPercent =
    currentPrice && currentPrice.salePriceMinor > 0
      ? Math.round((diffMinor / currentPrice.salePriceMinor) * 1000) / 10
      : null;

  const mrrDelta: Record<string, number> = {};
  if (input.priceChangePolicy === "NEW_SUBSCRIBERS_ONLY") {
    mrrDelta[canonical.currency] = 0;
  } else {
    mrrDelta[canonical.currency] = (totals.monthlyEquivalentMinor - (currentPrice?.monthlyEquivalentMinor ?? 0)) / 100;
  }

  return {
    expectedCurrentPriceId: currentPrice?.id ?? null,
    expiresAt: canonical.expiresAt,
    current: currentPrice
      ? {
          id: currentPrice.id,
          listPriceMinor: currentPrice.listPriceMinor,
          salePriceMinor: currentPrice.salePriceMinor,
          version: currentPrice.version,
        }
      : null,
    proposed: {
      listPriceMinor: totals.listPriceMinor,
      salePriceMinor: totals.salePriceMinor,
      totalMinor: totals.totalMinor,
      monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
      vatMinor: totals.vatMinor,
    },
    diff: {
      minor: diffMinor,
      percent: diffPercent,
      currency: canonical.currency,
      interval: canonical.billingInterval,
    },
    priceChangePolicy: input.priceChangePolicy,
    priceChangePolicyLabel: getPricePolicyLabel(input.priceChangePolicy),
    effectiveFrom: canonical.effectiveFrom,
    effectiveUntil: canonical.effectiveUntil,
    subscriptionImpact: summary,
    mrrEstimatedDelta: mrrDelta,
    affectsExistingSubscribers: policyAffectsExistingSubscribersNow(input.priceChangePolicy),
    notices: [
      "Geçmiş payment priceSnapshot kayıtları değişmeyecek.",
      "Kampanya ve kupon etkileri checkout sırasında yeniden çözümlenecek.",
      input.priceChangePolicy === "NEW_SUBSCRIBERS_ONLY"
        ? "Mevcut abonelikler mevcut fiyatla korunacak."
        : input.priceChangePolicy === "GRANDFATHERED"
          ? "Grandfathered aboneliklerin kilitli fiyatı değişmeyecek."
          : input.priceChangePolicy === "NEXT_RENEWAL"
            ? "Mevcut dönem fiyatı değişmeyecek; sonraki yenilemede geçerli olacak."
            : "Belirlenen tarihten sonra yenilemede geçerli olacak.",
    ],
  };
}

export async function publishAdminPlanPriceFromPreview(input: {
  planId: string;
  userId: string;
  reason: string;
  priceInput: PreviewInput;
  expectedCurrentPriceId?: string | null;
}) {
  const now = new Date();
  const { canonical, currentPrice } = await buildCanonicalPayload(
    input.planId,
    input.priceInput,
    input.userId,
    now
  );

  if (input.expectedCurrentPriceId !== undefined) {
    const actual = currentPrice?.id ?? null;
    if (input.expectedCurrentPriceId !== actual) {
      throw new PreviewStaleError();
    }
  }

  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) throw new AdminPlanServiceError("Plan bulunamadı.", 404);

  const effectiveFrom = new Date(canonical.effectiveFrom);
  const status = effectiveFrom > now ? "SCHEDULED" : "ACTIVE";

  const latest = await db.membershipPlanPrice.findFirst({
    where: {
      planId: input.planId,
      billingInterval: input.priceInput.billingInterval,
    },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  const totals = buildPriceTotals({
    listPriceMinor: canonical.listPriceMinor,
    salePriceMinor: canonical.salePriceMinor,
    interval: input.priceInput.billingInterval,
    vatRate: canonical.vatRate,
    vatIncluded: canonical.vatIncluded,
  });

  const result = await db.$transaction(async (tx) => {
    const price = await tx.membershipPlanPrice.create({
      data: {
        planId: input.planId,
        billingInterval: input.priceInput.billingInterval,
        version,
        status: "DRAFT",
        listPriceMinor: totals.listPriceMinor,
        salePriceMinor: totals.salePriceMinor,
        currency: canonical.currency,
        vatRate: canonical.vatRate,
        vatIncluded: canonical.vatIncluded,
        monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
        effectiveFrom,
        effectiveUntil: canonical.effectiveUntil ? new Date(canonical.effectiveUntil) : null,
        isAutoRenewEnabled: input.priceInput.isAutoRenewEnabled ?? true,
        isPublic: canonical.isPublic,
        priceChangePolicy: canonical.priceChangePolicy as SubscriptionPriceChangePolicy,
        adminNote: input.reason,
        createdByUserId: input.userId,
      },
    });

    if (status === "ACTIVE") {
      await expirePreviousActivePrices(tx, {
        planId: input.planId,
        billingInterval: input.priceInput.billingInterval,
        currency: canonical.currency,
        effectiveFrom,
        excludePriceId: price.id,
      });

      await applyPriceChangePolicyOnPublish(tx, {
        newPrice: { ...price, priceChangePolicy: price.priceChangePolicy },
        previousActivePrice: currentPrice
          ? {
              id: currentPrice.id,
              salePriceMinor: currentPrice.salePriceMinor,
              listPriceMinor: currentPrice.listPriceMinor,
              priceChangePolicy: currentPrice.priceChangePolicy,
            }
          : null,
      });
    }

    const updated = await tx.membershipPlanPrice.update({
      where: { id: price.id },
      data: {
        status,
        publishedByUserId: input.userId,
        publishedAt: now,
      },
    });

    if (status === "ACTIVE") {
      await syncLegacyPlanColumnIfApplicable(
        tx,
        plan,
        input.priceInput.billingInterval,
        totals.salePriceMinor,
        canonical.currency
      );
    }

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_PRICE_PUBLISHED",
      planId: input.planId,
      entityType: "MembershipPlanPrice",
      entityId: updated.id,
      displayMessage: `${plan.name} ${input.priceInput.billingInterval} v${version} yayınlandı.`,
      metadata: {
        priceId: updated.id,
        version,
        reason: input.reason,
        billingInterval: input.priceInput.billingInterval,
        currency: canonical.currency,
      },
      tx,
    });

    return updated;
  });

  invalidateAdminPlanCaches(input.planId);
  return result;
}
