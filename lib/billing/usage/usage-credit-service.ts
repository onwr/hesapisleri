import "server-only";

import type { UsageCreditStatus } from "@prisma/client";
import { db } from "@/lib/prisma";
import { invalidateCompanyEntitlementCache } from "@/lib/billing/entitlements/entitlement-cache";

export async function grantUsageCredit(input: {
  companyId: string;
  entitlementCode: string;
  granted: number;
  sourceType: string;
  sourceId?: string;
  expiresAt?: Date | null;
}) {
  const credit = await db.companyUsageCredit.create({
    data: {
      companyId: input.companyId,
      entitlementCode: input.entitlementCode,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      granted: input.granted,
      remaining: input.granted,
      expiresAt: input.expiresAt ?? null,
      status: "ACTIVE",
    },
  });

  invalidateCompanyEntitlementCache(input.companyId);
  return credit;
}

export async function getActiveUsageCredits(companyId: string, entitlementCode: string) {
  const now = new Date();
  return db.companyUsageCredit.findMany({
    where: {
      companyId,
      entitlementCode,
      status: "ACTIVE",
      remaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
  });
}

export async function consumeUsageCredit(input: {
  companyId: string;
  entitlementCode: string;
  quantity: number;
  idempotencyKey?: string;
}) {
  if (input.idempotencyKey) {
    const existing = await db.usageEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return { consumed: 0, duplicate: true };
  }

  let remaining = input.quantity;
  const credits = await getActiveUsageCredits(input.companyId, input.entitlementCode);

  return db.$transaction(async (tx) => {
    let consumed = 0;
    for (const credit of credits) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, credit.remaining);
      const newRemaining = credit.remaining - take;
      const status: UsageCreditStatus = newRemaining <= 0 ? "DEPLETED" : "ACTIVE";

      await tx.companyUsageCredit.update({
        where: { id: credit.id },
        data: { used: { increment: take }, remaining: newRemaining, status },
      });

      remaining -= take;
      consumed += take;
    }

    if (input.idempotencyKey && consumed > 0) {
      await tx.usageEvent.create({
        data: {
          companyId: input.companyId,
          entitlementCode: input.entitlementCode,
          quantity: consumed,
          action: "CONSUME",
          sourceType: "USAGE_CREDIT",
          idempotencyKey: input.idempotencyKey,
        },
      });
    }

    invalidateCompanyEntitlementCache(input.companyId);
    return { consumed, duplicate: false };
  });
}

export async function sumActiveUsageCreditBalance(
  companyId: string,
  entitlementCode: string
) {
  const credits = await getActiveUsageCredits(companyId, entitlementCode);
  return credits.reduce((sum, c) => sum + c.remaining, 0);
}
