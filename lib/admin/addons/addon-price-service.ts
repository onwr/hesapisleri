import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AddOnServiceError } from "@/lib/admin/addons/addon-errors";

export async function createAddOnPrice(input: {
  addOnId: string;
  billingInterval?: MembershipPeriod | null;
  listPriceMinor: number;
  salePriceMinor: number;
  vatRate?: number;
  vatIncluded?: boolean;
  effectiveFrom?: Date;
  actorUserId: string;
}) {
  const addOn = await db.membershipAddOn.findUnique({ where: { id: input.addOnId } });
  if (!addOn) throw new AddOnServiceError("Ek paket bulunamadı.", 404);

  if (addOn.type === "RECURRING" && !input.billingInterval) {
    throw new AddOnServiceError("Yinelenen paket için fatura dönemi zorunludur.", 400);
  }

  const latest = await db.membershipAddOnPrice.findFirst({
    where: { addOnId: input.addOnId, billingInterval: input.billingInterval ?? null },
    orderBy: { version: "desc" },
  });

  const price = await db.membershipAddOnPrice.create({
    data: {
      addOnId: input.addOnId,
      billingInterval: input.billingInterval ?? null,
      version: (latest?.version ?? 0) + 1,
      listPriceMinor: input.listPriceMinor,
      salePriceMinor: input.salePriceMinor,
      vatRate: input.vatRate ?? 20,
      vatIncluded: input.vatIncluded ?? false,
      effectiveFrom: input.effectiveFrom ?? new Date(),
      status: "DRAFT",
    },
  });

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      action: "ADDON_PRICE_CREATED",
      module: "admin-addons",
      message: JSON.stringify({ addOnId: input.addOnId, priceId: price.id }),
    },
  });

  return price;
}

export async function publishAddOnPrice(input: {
  addOnId: string;
  priceId: string;
  actorUserId: string;
}) {
  const price = await db.membershipAddOnPrice.findFirst({
    where: { id: input.priceId, addOnId: input.addOnId },
  });
  if (!price) throw new AddOnServiceError("Fiyat bulunamadı.", 404);

  return db.$transaction(async (tx) => {
    await tx.membershipAddOnPrice.updateMany({
      where: {
        addOnId: input.addOnId,
        billingInterval: price.billingInterval,
        status: "ACTIVE",
        id: { not: price.id },
      },
      data: { status: "EXPIRED", effectiveUntil: new Date() },
    });

    const published = await tx.membershipAddOnPrice.update({
      where: { id: price.id },
      data: { status: "ACTIVE", effectiveFrom: new Date() },
    });

    await tx.activityLog.create({
      data: {
        userId: input.actorUserId,
        action: "ADDON_PRICE_PUBLISHED",
        module: "admin-addons",
        message: JSON.stringify({ addOnId: input.addOnId, priceId: price.id }),
      },
    });

    return published;
  });
}

export async function getActiveAddOnPrice(input: {
  addOnId: string;
  billingInterval?: MembershipPeriod | null;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const prices = await db.membershipAddOnPrice.findMany({
    where: {
      addOnId: input.addOnId,
      billingInterval: input.billingInterval ?? null,
      status: "ACTIVE",
    },
    orderBy: { version: "desc" },
  });

  return (
    prices.find((p) => {
      if (p.effectiveFrom > now) return false;
      if (p.effectiveUntil && p.effectiveUntil <= now) return false;
      return true;
    }) ?? null
  );
}
