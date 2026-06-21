import "server-only";

import type { UsageEventAction } from "@prisma/client";
import { db } from "@/lib/prisma";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";
import { getOrCreateCurrentUsagePeriod } from "@/lib/billing/usage/usage-period-service";

export async function recordUsageEvent(input: {
  companyId: string;
  entitlementCode: string;
  quantity?: number;
  action: UsageEventAction;
  sourceType?: string;
  sourceId?: string;
  idempotencyKey?: string;
  periodId?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await db.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  const event = await db.usageEvent.create({
    data: {
      companyId: input.companyId,
      entitlementCode: input.entitlementCode,
      quantity: input.quantity ?? 1,
      action: input.action,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey: input.idempotencyKey,
      periodId: input.periodId,
    },
  });

  invalidateCompanyEntitlementCache(input.companyId);
  return event;
}

export async function consumeCompanyUsage(input: {
  companyId: string;
  entitlementCode: string;
  quantity?: number;
  idempotencyKey?: string;
  sourceType?: string;
  sourceId?: string;
}) {
  const quantity = input.quantity ?? 1;
  const period = await getOrCreateCurrentUsagePeriod({
    companyId: input.companyId,
    entitlementCode: input.entitlementCode,
  });

  return db.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.usageEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { event: existing, periodId: period.id, duplicate: true };
    }

    await tx.usagePeriod.update({
      where: { id: period.id },
      data: { used: { increment: quantity } },
    });

    const event = await tx.usageEvent.create({
      data: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        quantity,
        action: "CONSUME",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        periodId: period.id,
      },
    });

    invalidateCompanyEntitlementCache(input.companyId);
    return { event, periodId: period.id, duplicate: false };
  });
}

export async function reserveCompanyUsage(input: {
  companyId: string;
  entitlementCode: string;
  quantity?: number;
  idempotencyKey: string;
  sourceType?: string;
  sourceId?: string;
}) {
  const quantity = input.quantity ?? 1;
  const period = await getOrCreateCurrentUsagePeriod({
    companyId: input.companyId,
    entitlementCode: input.entitlementCode,
  });

  return db.$transaction(async (tx) => {
    const existing = await tx.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return { event: existing, periodId: period.id, duplicate: true };

    await tx.usagePeriod.update({
      where: { id: period.id },
      data: { reserved: { increment: quantity } },
    });

    const event = await tx.usageEvent.create({
      data: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        quantity,
        action: "RESERVE",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        idempotencyKey: input.idempotencyKey,
        periodId: period.id,
      },
    });

    invalidateCompanyEntitlementCache(input.companyId);
    return { event, periodId: period.id, duplicate: false };
  });
}

export async function finalizeCompanyUsage(input: {
  companyId: string;
  entitlementCode: string;
  idempotencyKey: string;
  quantity?: number;
}) {
  const quantity = input.quantity ?? 1;

  return db.$transaction(async (tx) => {
    const reserveEvent = await tx.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!reserveEvent || reserveEvent.action !== "RESERVE") {
      throw new Error("Rezervasyon bulunamadı.");
    }
    if (!reserveEvent.periodId) throw new Error("Dönem bulunamadı.");

    const finalizeKey = `${input.idempotencyKey}:finalize`;
    const existingFinalize = await tx.usageEvent.findUnique({
      where: { idempotencyKey: finalizeKey },
    });
    if (existingFinalize) return { duplicate: true };

    await tx.usagePeriod.update({
      where: { id: reserveEvent.periodId },
      data: {
        reserved: { decrement: quantity },
        used: { increment: quantity },
      },
    });

    await tx.usageEvent.create({
      data: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        quantity,
        action: "FINALIZE",
        sourceType: reserveEvent.sourceType,
        sourceId: reserveEvent.sourceId,
        idempotencyKey: finalizeKey,
        periodId: reserveEvent.periodId,
      },
    });

    invalidateCompanyEntitlementCache(input.companyId);
    return { duplicate: false };
  });
}

export async function releaseCompanyUsage(input: {
  companyId: string;
  entitlementCode: string;
  idempotencyKey: string;
  quantity?: number;
}) {
  const quantity = input.quantity ?? 1;

  return db.$transaction(async (tx) => {
    const reserveEvent = await tx.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (!reserveEvent) return { released: false };

    const releaseKey = `${input.idempotencyKey}:release`;
    const existingRelease = await tx.usageEvent.findUnique({
      where: { idempotencyKey: releaseKey },
    });
    if (existingRelease) return { released: true, duplicate: true };

    if (reserveEvent.periodId) {
      await tx.usagePeriod.update({
        where: { id: reserveEvent.periodId },
        data: { reserved: { decrement: quantity } },
      });
    }

    await tx.usageEvent.create({
      data: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        quantity,
        action: "RELEASE",
        sourceType: reserveEvent.sourceType,
        sourceId: reserveEvent.sourceId,
        idempotencyKey: releaseKey,
        periodId: reserveEvent.periodId,
      },
    });

    invalidateCompanyEntitlementCache(input.companyId);
    return { released: true, duplicate: false };
  });
}

export async function adjustCompanyUsage(input: {
  companyId: string;
  entitlementCode: string;
  delta: number;
  reason: string;
  actorUserId: string;
}) {
  const period = await getOrCreateCurrentUsagePeriod({
    companyId: input.companyId,
    entitlementCode: input.entitlementCode,
  });

  return db.$transaction(async (tx) => {
    const updated = await tx.usagePeriod.update({
      where: { id: period.id },
      data: { used: { increment: input.delta } },
    });

    await tx.usageEvent.create({
      data: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        quantity: Math.abs(input.delta),
        action: "ADJUST",
        sourceType: "ADMIN",
        sourceId: input.actorUserId,
        periodId: period.id,
      },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "USAGE_ADJUSTED",
        module: "admin-entitlements",
        message: JSON.stringify({
          entitlementCode: input.entitlementCode,
          delta: input.delta,
          reason: input.reason,
          periodId: period.id,
          usedAfter: updated.used,
        }),
      },
    });

    invalidateCompanyEntitlementCache(input.companyId);
    return updated;
  });
}
