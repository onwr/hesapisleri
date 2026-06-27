import "server-only";

import type { MembershipPeriod, PlanPriceStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  buildPriceTotals,
  parseMoneyToMinor,
  salePriceFromPercent,
} from "@/lib/billing/pricing-utils";
import { validatePriceOverlap, syncLegacyPlanColumnIfApplicable } from "@/lib/admin/plans/admin-plan-price-publish-service";
import { publishPlanPriceSecure } from "@/lib/admin/plans/admin-plan-price-publish-service";

export class MembershipPlanPriceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MembershipPlanPriceError";
    this.status = status;
  }
}

export type PlanPriceInput = {
  listPriceMinor?: number;
  listPrice?: string | number;
  salePriceMinor?: number;
  salePrice?: string | number;
  discountPercent?: number;
  vatRate?: number;
  vatIncluded?: boolean;
  effectiveFrom?: Date | string;
  effectiveUntil?: Date | string | null;
  isAutoRenewEnabled?: boolean;
  isPublic?: boolean;
  priceChangePolicy?: import("@prisma/client").SubscriptionPriceChangePolicy;
  adminNote?: string | null;
  currency?: string;
};

function resolveMinor(
  minor: number | undefined,
  decimal: string | number | undefined
) {
  if (minor != null) return minor;
  if (decimal != null) return parseMoneyToMinor(decimal);
  throw new MembershipPlanPriceError("Fiyat girilmelidir.");
}

export async function listPlanPrices(planId: string) {
  return db.membershipPlanPrice.findMany({
    where: { planId },
    orderBy: [{ billingInterval: "asc" }, { version: "desc" }],
  });
}

export async function getPlanPriceMatrix(planId: string) {
  const intervals: MembershipPeriod[] = [
    "MONTHLY",
    "QUARTERLY",
    "SEMI_ANNUAL",
    "YEARLY",
  ];
  const all = await listPlanPrices(planId);
  const matrix: Record<
    MembershipPeriod,
    {
      active: (typeof all)[number] | null;
      draft: (typeof all)[number] | null;
      scheduled: (typeof all)[number] | null;
    }
  > = {
    MONTHLY: { active: null, draft: null, scheduled: null },
    QUARTERLY: { active: null, draft: null, scheduled: null },
    SEMI_ANNUAL: { active: null, draft: null, scheduled: null },
    YEARLY: { active: null, draft: null, scheduled: null },
  };

  for (const price of all) {
    const bucket = matrix[price.billingInterval];
    if (price.status === "ACTIVE" && !bucket.active) bucket.active = price;
    if (price.status === "DRAFT" && !bucket.draft) bucket.draft = price;
    if (price.status === "SCHEDULED" && !bucket.scheduled) {
      bucket.scheduled = price;
    }
  }

  return matrix;
}

export async function createPlanPriceVersion(input: {
  planId: string;
  billingInterval: MembershipPeriod;
  data: PlanPriceInput;
  userId: string;
  publish?: boolean;
}) {
  const plan = await db.membershipPlan.findUnique({ where: { id: input.planId } });
  if (!plan) {
    throw new MembershipPlanPriceError("Plan bulunamadı.", 404);
  }

  const listPriceMinor = resolveMinor(
    input.data.listPriceMinor,
    input.data.listPrice
  );
  let salePriceMinor = resolveMinor(
    input.data.salePriceMinor,
    input.data.salePrice
  );

  if (input.data.discountPercent != null) {
    const fromPercent = salePriceFromPercent(
      listPriceMinor,
      input.data.discountPercent
    );
    if (
      input.data.salePriceMinor == null &&
      input.data.salePrice == null &&
      salePriceMinor === listPriceMinor
    ) {
      salePriceMinor = fromPercent;
    }
  }

  const vatRate = input.data.vatRate ?? plan.vatRate;
  const vatIncluded = input.data.vatIncluded ?? plan.vatIncluded;
  const currency = input.data.currency ?? (plan.defaultCurrency || plan.currency);
  const totals = buildPriceTotals({
    listPriceMinor,
    salePriceMinor,
    interval: input.billingInterval,
    vatRate,
    vatIncluded,
    discountPercent: input.data.discountPercent,
  });

  const latest = await db.membershipPlanPrice.findFirst({
    where: { planId: input.planId, billingInterval: input.billingInterval },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  const effectiveFrom = input.data.effectiveFrom
    ? new Date(input.data.effectiveFrom)
    : new Date();
  const effectiveUntil = input.data.effectiveUntil
    ? new Date(input.data.effectiveUntil)
    : null;

  await validatePriceOverlap({
    planId: input.planId,
    billingInterval: input.billingInterval,
    currency,
    effectiveFrom,
    effectiveUntil,
  });

  const created = await db.$transaction(async (tx) => {
    const price = await tx.membershipPlanPrice.create({
      data: {
        planId: input.planId,
        billingInterval: input.billingInterval,
        version,
        status: "DRAFT",
        listPriceMinor: totals.listPriceMinor,
        salePriceMinor: totals.salePriceMinor,
        currency,
        vatRate,
        vatIncluded,
        monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
        effectiveFrom,
        effectiveUntil,
        isAutoRenewEnabled: input.data.isAutoRenewEnabled ?? true,
        isPublic: input.data.isPublic ?? true,
        priceChangePolicy: input.data.priceChangePolicy ?? "NEW_SUBSCRIBERS_ONLY",
        adminNote: input.data.adminNote ?? null,
        createdByUserId: input.userId,
        publishedByUserId: null,
        publishedAt: null,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: input.userId,
        action: "PRICE_VERSION_CREATED",
        module: "admin-plans",
        message: `${plan.name} ${input.billingInterval} fiyat v${version} oluşturuldu.`,
      },
    });

    return price;
  });

  if (input.publish) {
    return publishPlanPriceSecure({ priceId: created.id, userId: input.userId });
  }

  return created;
}

export async function publishPlanPrice(input: {
  priceId: string;
  userId: string;
}) {
  return publishPlanPriceSecure(input);
}

export function serializePlanPriceForAdmin(price: {
  id: string;
  billingInterval: MembershipPeriod;
  version: number;
  status: PlanPriceStatus;
  listPriceMinor: number;
  salePriceMinor: number;
  monthlyEquivalentMinor: number;
  vatRate: number;
  vatIncluded: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  isAutoRenewEnabled: boolean;
  isPublic: boolean;
  priceChangePolicy: import("@prisma/client").SubscriptionPriceChangePolicy;
  adminNote: string | null;
  currency?: string;
}) {
  const totals = buildPriceTotals({
    listPriceMinor: price.listPriceMinor,
    salePriceMinor: price.salePriceMinor,
    interval: price.billingInterval,
    vatRate: price.vatRate,
    vatIncluded: price.vatIncluded,
  });

  return {
    id: price.id,
    billingInterval: price.billingInterval,
    version: price.version,
    status: price.status,
    currency: price.currency ?? "TRY",
    listPriceMinor: price.listPriceMinor,
    salePriceMinor: price.salePriceMinor,
    listPrice: price.listPriceMinor / 100,
    salePrice: price.salePriceMinor / 100,
    discountPercent: totals.discountPercent,
    discountMinor: totals.discountMinor,
    monthlyEquivalentMinor: price.monthlyEquivalentMinor,
    monthlyEquivalent: price.monthlyEquivalentMinor / 100,
    vatRate: price.vatRate,
    vatIncluded: price.vatIncluded,
    subtotalMinor: totals.subtotalMinor,
    vatMinor: totals.vatMinor,
    totalMinor: totals.totalMinor,
    effectiveFrom: price.effectiveFrom.toISOString(),
    effectiveUntil: price.effectiveUntil?.toISOString() ?? null,
    isAutoRenewEnabled: price.isAutoRenewEnabled,
    isPublic: price.isPublic,
    priceChangePolicy: price.priceChangePolicy,
    adminNote: price.adminNote,
  };
}

// Re-export for tests
export { syncLegacyPlanColumnIfApplicable };
