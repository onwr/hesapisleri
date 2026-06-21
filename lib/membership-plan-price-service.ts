import "server-only";

import type { MembershipPeriod, PlanPriceStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  buildPriceTotals,
  parseMoneyToMinor,
  salePriceFromPercent,
} from "@/lib/billing/pricing-utils";

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
  const status: PlanPriceStatus = input.publish
    ? effectiveFrom > new Date()
      ? "SCHEDULED"
      : "ACTIVE"
    : "DRAFT";

  return db.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await tx.membershipPlanPrice.updateMany({
        where: {
          planId: input.planId,
          billingInterval: input.billingInterval,
          status: "ACTIVE",
        },
        data: {
          status: "EXPIRED",
          effectiveUntil: effectiveFrom,
        },
      });
    }

    const price = await tx.membershipPlanPrice.create({
      data: {
        planId: input.planId,
        billingInterval: input.billingInterval,
        version,
        status,
        listPriceMinor: totals.listPriceMinor,
        salePriceMinor: totals.salePriceMinor,
        currency: plan.defaultCurrency || plan.currency,
        vatRate,
        vatIncluded,
        monthlyEquivalentMinor: totals.monthlyEquivalentMinor,
        effectiveFrom,
        effectiveUntil: input.data.effectiveUntil
          ? new Date(input.data.effectiveUntil)
          : null,
        isAutoRenewEnabled: input.data.isAutoRenewEnabled ?? true,
        isPublic: input.data.isPublic ?? true,
        priceChangePolicy: input.data.priceChangePolicy ?? "NEW_SUBSCRIBERS_ONLY",
        adminNote: input.data.adminNote ?? null,
        createdByUserId: input.userId,
        publishedByUserId: input.publish ? input.userId : null,
        publishedAt: input.publish ? new Date() : null,
      },
    });

    await syncLegacyPlanColumn(tx, input.planId, input.billingInterval, totals.salePriceMinor);

    await tx.activityLog.create({
      data: {
        userId: input.userId,
        action: input.publish ? "PRICE_VERSION_PUBLISHED" : "PRICE_VERSION_CREATED",
        module: "membership-plans",
        message: `${plan.name} ${input.billingInterval} fiyat v${version} ${status}`,
      },
    });

    return price;
  });
}

async function syncLegacyPlanColumn(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  planId: string,
  interval: MembershipPeriod,
  salePriceMinor: number
) {
  const decimal = salePriceMinor / 100;
  const data =
    interval === "MONTHLY"
      ? { monthlyPrice: decimal }
      : interval === "QUARTERLY"
        ? { quarterlyPrice: decimal }
        : interval === "SEMI_ANNUAL"
          ? { semiAnnualPrice: decimal }
          : { yearlyPrice: decimal };

  await tx.membershipPlan.update({ where: { id: planId }, data });
}

export async function publishPlanPrice(input: {
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

  return db.$transaction(async (tx) => {
    if (status === "ACTIVE") {
      await tx.membershipPlanPrice.updateMany({
        where: {
          planId: price.planId,
          billingInterval: price.billingInterval,
          status: "ACTIVE",
          id: { not: price.id },
        },
        data: { status: "EXPIRED", effectiveUntil: effectiveFrom },
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

    await syncLegacyPlanColumn(
      tx,
      price.planId,
      price.billingInterval,
      price.salePriceMinor
    );

    return updated;
  });
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
