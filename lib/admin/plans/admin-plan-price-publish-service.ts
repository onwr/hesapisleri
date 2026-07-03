import "server-only";

import type { MembershipPeriod, PlanPriceStatus, SubscriptionPriceChangePolicy } from "@prisma/client";
import { db } from "@/lib/prisma";
import { assertNoPriceOverlap } from "@/lib/admin/plans/admin-plan-price-overlap";
import { MembershipPlanPriceError } from "@/lib/membership-plan-price-service";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";

const ACTIVE_SUB_STATUSES = ["ACTIVE", "TRIAL", "CANCEL_AT_PERIOD_END"] as const;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export async function syncLegacyPlanColumnIfApplicable(
  tx: Tx,
  plan: { id: string; defaultCurrency: string; currency: string },
  interval: MembershipPeriod,
  salePriceMinor: number,
  priceCurrency: string
) {
  const defaultCurrency = plan.defaultCurrency || plan.currency;
  if (priceCurrency !== defaultCurrency) return;

  const decimal = salePriceMinor / 100;
  const data =
    interval === "MONTHLY"
      ? { monthlyPrice: decimal }
      : interval === "QUARTERLY"
        ? { quarterlyPrice: decimal }
        : interval === "SEMI_ANNUAL"
          ? { semiAnnualPrice: decimal }
          : { yearlyPrice: decimal };

  await tx.membershipPlan.update({ where: { id: plan.id }, data });
}

export async function validatePriceOverlap(input: {
  planId: string;
  billingInterval: MembershipPeriod;
  currency: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  excludePriceId?: string;
}) {
  const existing = await db.membershipPlanPrice.findMany({
    where: {
      planId: input.planId,
      billingInterval: input.billingInterval,
      currency: input.currency,
      status: { in: ["ACTIVE", "SCHEDULED"] },
      ...(input.excludePriceId ? { id: { not: input.excludePriceId } } : {}),
    },
    select: { effectiveFrom: true, effectiveUntil: true },
  });

  assertNoPriceOverlap(
    { effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil },
    existing,
    {
      planId: input.planId,
      billingInterval: input.billingInterval,
      currency: input.currency,
    }
  );
}

async function lockSubscriptionToCurrentPrice(
  tx: Tx,
  sub: {
    id: string;
    lockedPlanPriceId: string | null;
    lockedPriceMinor: number | null;
  },
  currentPrice: {
    id: string;
    salePriceMinor: number;
    listPriceMinor: number;
    priceChangePolicy: SubscriptionPriceChangePolicy;
  }
) {
  if (sub.lockedPlanPriceId && sub.lockedPriceMinor != null) return;

  await tx.companySubscription.update({
    where: { id: sub.id },
    data: {
      lockedPlanPriceId: currentPrice.id,
      lockedPriceMinor: currentPrice.salePriceMinor,
      lockedListPriceMinor: currentPrice.listPriceMinor,
      priceLockType: "NEW_SUBSCRIBERS_ONLY",
    },
  });
}

export async function applyPriceChangePolicyOnPublish(
  tx: Tx,
  input: {
    newPrice: {
      id: string;
      planId: string;
      billingInterval: MembershipPeriod;
      currency: string;
      effectiveFrom: Date;
      salePriceMinor: number;
      listPriceMinor: number;
      priceChangePolicy: SubscriptionPriceChangePolicy;
    };
    previousActivePrice: {
      id: string;
      salePriceMinor: number;
      listPriceMinor: number;
      priceChangePolicy: SubscriptionPriceChangePolicy;
    } | null;
  }
) {
  const { newPrice, previousActivePrice } = input;

  const subs = await tx.companySubscription.findMany({
    where: {
      planId: newPrice.planId,
      billingInterval: newPrice.billingInterval,
      status: { in: [...ACTIVE_SUB_STATUSES] },
    },
    select: {
      id: true,
      lockedPlanPriceId: true,
      lockedPriceMinor: true,
      lockedListPriceMinor: true,
      priceLockType: true,
      nextBillingAt: true,
      currentPeriodEnd: true,
    },
  });

  for (const sub of subs) {
    switch (newPrice.priceChangePolicy) {
      case "NEW_SUBSCRIBERS_ONLY": {
        if (previousActivePrice) {
          await lockSubscriptionToCurrentPrice(tx, sub, previousActivePrice);
        } else if (!sub.lockedPlanPriceId || sub.lockedPriceMinor == null) {
          throw new MembershipPlanPriceError(
            "Fiyat kilidi olmayan abonelikler var; önce mevcut fiyat kilitlenmeli veya yayın engellenmeli.",
            409
          );
        }
        break;
      }
      case "GRANDFATHERED":
        // Mevcut lockedPlanPriceId / lockedPriceMinor değiştirilmez.
        break;
      case "NEXT_RENEWAL": {
        const effectiveAt = sub.nextBillingAt ?? sub.currentPeriodEnd;
        if (!effectiveAt) continue;
        await tx.companySubscription.update({
          where: { id: sub.id },
          data: {
            nextPlanPriceId: newPrice.id,
            nextPriceEffectiveAt: effectiveAt,
          },
        });
        break;
      }
      case "AFTER_DATE": {
        await tx.companySubscription.update({
          where: { id: sub.id },
          data: {
            nextPlanPriceId: newPrice.id,
            nextPriceEffectiveAt: newPrice.effectiveFrom,
          },
        });
        break;
      }
    }
  }
}

export async function expirePreviousActivePrices(
  tx: Tx,
  input: {
    planId: string;
    billingInterval: MembershipPeriod;
    currency: string;
    effectiveFrom: Date;
    excludePriceId: string;
  }
) {
  await tx.membershipPlanPrice.updateMany({
    where: {
      planId: input.planId,
      billingInterval: input.billingInterval,
      currency: input.currency,
      status: "ACTIVE",
      id: { not: input.excludePriceId },
    },
    data: {
      status: "EXPIRED",
      effectiveUntil: input.effectiveFrom,
    },
  });
}

export async function publishPlanPriceSecure(input: {
  priceId: string;
  userId: string;
}) {
  const price = await db.membershipPlanPrice.findUnique({
    where: { id: input.priceId },
    include: { plan: true },
  });

  if (!price) {
    throw new MembershipPlanPriceError("Fiyat kaydı bulunamadı.", 404);
  }
  if (price.status !== "DRAFT" && price.status !== "SCHEDULED") {
    throw new MembershipPlanPriceError("Yalnızca taslak veya zamanlanmış fiyat yayınlanabilir.");
  }

  const effectiveFrom = price.effectiveFrom;
  const status: PlanPriceStatus =
    effectiveFrom > new Date() ? "SCHEDULED" : "ACTIVE";

  await validatePriceOverlap({
    planId: price.planId,
    billingInterval: price.billingInterval,
    currency: price.currency,
    effectiveFrom,
    effectiveUntil: price.effectiveUntil,
    excludePriceId: price.id,
  });

  const previousActive =
    status === "ACTIVE"
      ? await db.membershipPlanPrice.findFirst({
          where: {
            planId: price.planId,
            billingInterval: price.billingInterval,
            currency: price.currency,
            status: "ACTIVE",
            id: { not: price.id },
          },
          orderBy: { version: "desc" },
        })
      : null;

  return db.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await expirePreviousActivePrices(tx, {
        planId: price.planId,
        billingInterval: price.billingInterval,
        currency: price.currency,
        effectiveFrom,
        excludePriceId: price.id,
      });

      await applyPriceChangePolicyOnPublish(tx, {
        newPrice: price,
        previousActivePrice: previousActive,
      });
    }

    const updated = await tx.membershipPlanPrice.update({
      where: { id: price.id },
      data: {
        status,
        publishedByUserId: input.userId,
        publishedAt: new Date(),
      },
    });

    if (status === "ACTIVE") {
      await syncLegacyPlanColumnIfApplicable(
        tx,
        price.plan,
        price.billingInterval,
        price.salePriceMinor,
        price.currency
      );
    }

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_PRICE_PUBLISHED",
      planId: price.planId,
      entityType: "MembershipPlanPrice",
      entityId: price.id,
      displayMessage: `${price.plan.name} ${price.billingInterval} fiyat v${price.version} yayınlandı.`,
      metadata: {
        priceId: price.id,
        version: price.version,
        status,
        billingInterval: price.billingInterval,
        currency: price.currency,
      },
      tx,
    });

    return updated;
  });
}

/** Mevcut fiyat satırında yalnızca güvenli lifecycle alanları güncellenebilir. */
export const FORBIDDEN_PRICE_PATCH_FIELDS = [
  "listPriceMinor",
  "listPrice",
  "salePriceMinor",
  "salePrice",
  "currency",
  "billingInterval",
  "vatRate",
  "vatIncluded",
  "priceChangePolicy",
  "discountPercent",
] as const;

export function assertSafePricePatch(body: Record<string, unknown>) {
  for (const field of FORBIDDEN_PRICE_PATCH_FIELDS) {
    if (field in body) {
      throw new MembershipPlanPriceError(
        `"${field}" mevcut fiyat satırında güncellenemez. Fiyatı Değiştir akışını kullanın.`,
        400
      );
    }
  }
}

export async function cancelScheduledAdminPlanPrice(input: {
  planId: string;
  priceId: string;
  userId: string;
  reason: string;
}) {
  const price = await db.membershipPlanPrice.findFirst({
    where: { id: input.priceId, planId: input.planId },
    include: { plan: true },
  });

  if (!price) {
    throw new MembershipPlanPriceError("Fiyat kaydı bulunamadı.", 404);
  }

  if (price.status !== "SCHEDULED" && price.status !== "DRAFT") {
    throw new MembershipPlanPriceError(
      "Yalnızca planlanmış veya taslak fiyat iptal edilebilir.",
      400
    );
  }

  const usage = await db.companySubscription.count({
    where: {
      OR: [{ lockedPlanPriceId: price.id }, { nextPlanPriceId: price.id }],
    },
  });
  if (usage > 0) {
    throw new MembershipPlanPriceError(
      "Bu fiyat aboneliklerde kullanıldığı için iptal edilemez.",
      409
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.membershipPlanPrice.update({
      where: { id: price.id },
      data: {
        status: "ARCHIVED",
        adminNote: input.reason,
      },
    });

    await logAdminPlanAudit({
      userId: input.userId,
      action: "PLAN_PRICE_CANCELLED",
      planId: input.planId,
      entityType: "MembershipPlanPrice",
      entityId: price.id,
      displayMessage: `${price.plan.name} ${price.billingInterval} v${price.version} iptal edildi.`,
      metadata: { priceId: price.id, reason: input.reason },
      tx,
    });

    return row;
  });

  return updated;
}
