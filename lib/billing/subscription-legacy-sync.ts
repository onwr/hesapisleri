import "server-only";

import type { MembershipStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

function mapSubscriptionStatusToLegacy(
  status: SubscriptionStatus
): MembershipStatus {
  if (status === "ACTIVE" || status === "TRIAL" || status === "CANCEL_AT_PERIOD_END") {
    return "ACTIVE";
  }
  if (status === "PAST_DUE" || status === "GRACE_PERIOD") {
    return "PAST_DUE";
  }
  return "CANCELLED";
}

export async function syncLegacyMembershipSettings(
  companyId: string,
  input: {
    subscription: {
      status: SubscriptionStatus;
      nextBillingAt?: Date | null;
      currentPeriodEnd?: Date | null;
      planId?: string | null;
    };
    lastPaymentDate?: Date | null;
    monthlyFeeMinor?: number | null;
    membershipNote?: string | null;
  },
  tx: Tx | typeof db = db
) {
  const monthlyFee =
    input.monthlyFeeMinor != null
      ? input.monthlyFeeMinor / 100
      : undefined;

  await tx.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      membershipStatus: mapSubscriptionStatusToLegacy(input.subscription.status),
      nextPaymentDate:
        input.subscription.nextBillingAt ??
        input.subscription.currentPeriodEnd ??
        null,
      lastPaymentDate: input.lastPaymentDate ?? null,
      monthlyFee: monthlyFee ?? 0,
      membershipNote: input.membershipNote ?? null,
    },
    update: {
      membershipStatus: mapSubscriptionStatusToLegacy(input.subscription.status),
      nextPaymentDate:
        input.subscription.nextBillingAt ??
        input.subscription.currentPeriodEnd ??
        undefined,
      ...(input.lastPaymentDate ? { lastPaymentDate: input.lastPaymentDate } : {}),
      ...(monthlyFee != null ? { monthlyFee } : {}),
      ...(input.membershipNote !== undefined
        ? { membershipNote: input.membershipNote }
        : {}),
    },
  });
}

export async function auditSubscriptionLegacyMismatches(limit = 200) {
  const rows = await db.companySubscription.findMany({
    take: limit,
    include: { company: { include: { settings: true } } },
  });

  const mismatches: Array<{
    companyId: string;
    companyName: string;
    field: string;
    subscriptionValue: string;
    settingsValue: string;
  }> = [];

  for (const row of rows) {
    const settings = row.company.settings;
    if (!settings) {
      mismatches.push({
        companyId: row.companyId,
        companyName: row.company.name,
        field: "settings_missing",
        subscriptionValue: row.status,
        settingsValue: "—",
      });
      continue;
    }

    const expected = mapSubscriptionStatusToLegacy(row.status);
    if (settings.membershipStatus !== expected) {
      mismatches.push({
        companyId: row.companyId,
        companyName: row.company.name,
        field: "status",
        subscriptionValue: row.status,
        settingsValue: settings.membershipStatus,
      });
    }

    const subNext = row.nextBillingAt ?? row.currentPeriodEnd;
    const settingsNext = settings.nextPaymentDate;
    if (subNext && settingsNext) {
      const diff = Math.abs(subNext.getTime() - settingsNext.getTime());
      if (diff > 86_400_000) {
        mismatches.push({
          companyId: row.companyId,
          companyName: row.company.name,
          field: "nextPaymentDate",
          subscriptionValue: subNext.toISOString(),
          settingsValue: settingsNext.toISOString(),
        });
      }
    }
  }

  const withoutSubscription = await db.company.count({
    where: { subscription: null },
  });

  return { mismatches, withoutSubscription, checked: rows.length };
}
