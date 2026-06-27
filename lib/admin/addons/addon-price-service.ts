import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";
import {
  adminAddonPriceCreateSchema,
  adminAddonPricePublishSchema,
} from "@/lib/admin/addons/admin-addon-schemas";
import { logAdminAddOnAudit } from "@/lib/admin/addons/admin-addon-audit-service";
import { invalidateAdminAddOnCaches } from "@/lib/admin/addons/admin-addon-cache";
import {
  assertNoAddOnPriceOverlap,
  AddOnPriceOverlapError,
} from "@/lib/admin/addons/admin-addon-price-overlap";
import { findEffectiveAddOnPricesAt } from "@/lib/admin/addons/admin-addon-price-resolution-utils";

export async function createAddOnPrice(
  addOnId: string,
  actorUserId: string,
  input: Record<string, unknown>
) {
  const parsed = adminAddonPriceCreateSchema.parse(input);

  const addOn = await db.membershipAddOn.findUnique({ where: { id: addOnId } });
  if (!addOn) throw new AddOnServiceError("Ek paket bulunamadı.", 404);
  if (addOn.status === "ARCHIVED") {
    throw new AddOnServiceError("Arşivlenmiş add-on için fiyat eklenemez.");
  }

  if (addOn.type === "RECURRING" && !parsed.billingInterval) {
    throw new AddOnServiceError("Yinelenen paket için fatura dönemi zorunludur.", 400);
  }

  if (parsed.listPriceMinor < 0 || parsed.salePriceMinor < 0) {
    throw new AddOnServiceError("Fiyat negatif olamaz.", 400);
  }

  if (parsed.currency !== addOn.currency) {
    throw new AddOnServiceError("Fiyat para birimi add-on para birimi ile uyumlu olmalıdır.", 400);
  }

  const billingInterval = parsed.billingInterval ?? null;
  const effectiveFrom = parsed.effectiveFrom ? new Date(parsed.effectiveFrom) : new Date();
  const effectiveUntil = parsed.effectiveUntil ? new Date(parsed.effectiveUntil) : null;

  if (effectiveUntil && effectiveUntil <= effectiveFrom) {
    throw new AddOnServiceError("Bitiş tarihi başlangıçtan sonra olmalıdır.", 400);
  }

  const existingRanges = await db.membershipAddOnPrice.findMany({
    where: {
      addOnId,
      billingInterval,
      currency: parsed.currency,
      status: { in: ["ACTIVE", "DRAFT"] },
    },
    select: { effectiveFrom: true, effectiveUntil: true },
  });

  try {
    assertNoAddOnPriceOverlap(
      { effectiveFrom, effectiveUntil },
      existingRanges,
      { addOnId, billingInterval, currency: parsed.currency }
    );
  } catch (error) {
    if (error instanceof AddOnPriceOverlapError) {
      throw new AddOnServiceError(error.message, error.status);
    }
    throw error;
  }

  const latest = await db.membershipAddOnPrice.findFirst({
    where: { addOnId, billingInterval, currency: parsed.currency },
    orderBy: { version: "desc" },
  });

  const price = await db.$transaction(async (tx) => {
    const row = await tx.membershipAddOnPrice.create({
      data: {
        addOnId,
        billingInterval,
        version: (latest?.version ?? 0) + 1,
        listPriceMinor: parsed.listPriceMinor,
        salePriceMinor: parsed.salePriceMinor,
        currency: parsed.currency,
        vatRate: parsed.vatRate ?? addOn.vatRate,
        vatIncluded: parsed.vatIncluded ?? addOn.vatIncluded,
        effectiveFrom,
        effectiveUntil,
        status: "DRAFT",
      },
    });

    await logAdminAddOnAudit({
      userId: actorUserId,
      action: "ADDON_PRICE_CREATED",
      addOnId,
      displayMessage: `Add-on fiyatı oluşturuldu: v${row.version}`,
      metadata: { priceId: row.id, reason: parsed.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminAddOnCaches(addOnId);
  return price;
}

export async function publishAddOnPrice(input: {
  addOnId: string;
  priceId: string;
  actorUserId: string;
  body?: Record<string, unknown>;
}) {
  const parsed =
    input.body && Object.keys(input.body).length > 0
      ? adminAddonPricePublishSchema.parse(input.body)
      : undefined;

  const price = await db.membershipAddOnPrice.findFirst({
    where: { id: input.priceId, addOnId: input.addOnId },
  });
  if (!price) throw new AddOnServiceError("Fiyat bulunamadı.", 404);

  const published = await db.$transaction(async (tx) => {
    await tx.membershipAddOnPrice.updateMany({
      where: {
        addOnId: input.addOnId,
        billingInterval: price.billingInterval,
        currency: price.currency,
        status: "ACTIVE",
        id: { not: price.id },
      },
      data: { status: "EXPIRED", effectiveUntil: price.effectiveFrom },
    });

    const row = await tx.membershipAddOnPrice.update({
      where: { id: price.id },
      data: { status: "ACTIVE" },
    });

    await logAdminAddOnAudit({
      userId: input.actorUserId,
      action: "ADDON_PRICE_PUBLISHED",
      addOnId: input.addOnId,
      displayMessage: `Add-on fiyatı yayınlandı: v${row.version}`,
      metadata: { priceId: price.id, reason: parsed?.reason ?? null },
      tx,
    });

    return row;
  });

  invalidateAdminAddOnCaches(input.addOnId);
  return published;
}

export async function getActiveAddOnPrice(input: {
  addOnId: string;
  billingInterval?: MembershipPeriod | null;
  currency?: string;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const interval = input.billingInterval ?? null;

  const prices = await db.membershipAddOnPrice.findMany({
    where: {
      addOnId: input.addOnId,
      billingInterval: interval,
      status: "ACTIVE",
      ...(input.currency ? { currency: input.currency } : {}),
    },
    orderBy: { version: "desc" },
  });

  const effective = findEffectiveAddOnPricesAt(
    prices,
    interval,
    input.currency ?? prices[0]?.currency ?? "TRY",
    now
  );

  if (effective.length > 1) return null;
  return effective[0] ?? null;
}
