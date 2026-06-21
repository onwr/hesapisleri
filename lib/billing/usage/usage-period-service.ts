import "server-only";

import { db } from "@/lib/prisma";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";

function monthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export async function getOrCreateCurrentUsagePeriod(input: {
  companyId: string;
  entitlementCode: string;
  now?: Date;
  limitSnapshot?: number | null;
}) {
  const now = input.now ?? new Date();
  const meta = getEntitlementMeta(input.entitlementCode);
  const resetPeriod = meta?.resetPeriod ?? "MONTHLY";

  let periodStart: Date;
  let periodEnd: Date;

  if (resetPeriod === "MONTHLY") {
    ({ start: periodStart, end: periodEnd } = monthBounds(now));
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const existing = await db.usagePeriod.findUnique({
    where: {
      companyId_entitlementCode_periodStart: {
        companyId: input.companyId,
        entitlementCode: input.entitlementCode,
        periodStart,
      },
    },
  });

  if (existing) return existing;

  return db.usagePeriod.create({
    data: {
      companyId: input.companyId,
      entitlementCode: input.entitlementCode,
      periodStart,
      periodEnd,
      limitSnapshot: input.limitSnapshot ?? null,
      resetType: resetPeriod,
    },
  });
}

export async function resetExpiredUsagePeriods(now = new Date()) {
  const expired = await db.usagePeriod.findMany({
    where: { periodEnd: { lte: now } },
    select: { companyId: true, entitlementCode: true },
    distinct: ["companyId", "entitlementCode"],
  });

  let created = 0;
  for (const row of expired) {
    const current = await getOrCreateCurrentUsagePeriod({
      companyId: row.companyId,
      entitlementCode: row.entitlementCode,
      now,
    });
    if (current.periodStart > now || current.periodEnd > now) created += 1;
  }

  return { processed: expired.length, periodsEnsured: created };
}
