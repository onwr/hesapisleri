import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { AdminPlanServiceError } from "@/lib/admin/plans/admin-plan-patch-service";
import { ACTIVE_SUB_STATUSES } from "@/lib/admin/plans/admin-plan-issue-service";
import {
  schedulePendingChange,
} from "@/lib/billing/subscription-pending-change-service";
import {
  invalidateAdminPlanCaches,
  invalidateAdminPlanEntitlementCaches,
} from "@/lib/admin/plans/admin-plan-cache";
import { invalidateAdminSubscriptionCaches } from "@/lib/admin/subscriptions/admin-subscription-cache";
import { logAdminPlanAudit } from "@/lib/admin/plans/admin-plan-audit-service";
import { resolveCanonicalBillingPeriod } from "@/lib/billing/canonical-billing-period";
import { loadTargetActivePricesByPeriod } from "@/lib/admin/plans/admin-plan-target-price-utils";

const MIGRATION_BATCH_SIZE = 50;

export type MigrationTiming = "AT_RENEWAL" | "IMMEDIATE";

export type MigrationPeriodMapping = Partial<
  Record<MembershipPeriod, MembershipPeriod>
>;

export type MigrationSkipReason =
  | "NOT_FOUND"
  | "NOT_ON_SOURCE"
  | "ALREADY_ON_TARGET"
  | "SOURCE_PERIOD_UNKNOWN"
  | "TARGET_PERIOD_UNMAPPED"
  | "TARGET_PRICE_MISSING"
  | "TARGET_PRICE_DRAFT"
  | "ALREADY_SCHEDULED"
  | "MIGRATION_FAILED";

export type MigrationSkippedItem = {
  subscriptionId: string;
  companyName?: string;
  reasonCode: MigrationSkipReason;
  reason: string;
};

export type MigrationResult = {
  migrated: string[];
  skipped: MigrationSkippedItem[];
  summary: {
    migratedCount: number;
    skippedCount: number;
    message: string;
    skipGroups: Array<{ reason: string; count: number }>;
  };
};

const SKIP_LABELS: Record<MigrationSkipReason, string> = {
  NOT_FOUND: "Abonelik bulunamadı",
  NOT_ON_SOURCE: "Kaynak plana ait değil",
  ALREADY_ON_TARGET: "Zaten bu planda",
  SOURCE_PERIOD_UNKNOWN: "Kaynak dönem belirlenemedi",
  TARGET_PERIOD_UNMAPPED: "Hedef planda eşleşen dönem yok",
  TARGET_PRICE_MISSING: "Hedef fiyat bulunamadı",
  TARGET_PRICE_DRAFT: "Hedef fiyat henüz yayınlanmamış",
  ALREADY_SCHEDULED: "Zaten planlanmış",
  MIGRATION_FAILED: "Taşıma başarısız",
};

function buildMigrationSummary(
  migratedCount: number,
  skipped: MigrationSkippedItem[],
  targetPlanName?: string
): MigrationResult["summary"] {
  const groups = new Map<string, number>();
  for (const item of skipped) {
    const label = SKIP_LABELS[item.reasonCode] ?? item.reason;
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }

  const skipGroups = [...groups.entries()].map(([reason, count]) => ({
    reason,
    count,
  }));

  let message =
    migratedCount > 0
      ? `${migratedCount} abonelik${targetPlanName ? ` ${targetPlanName} planına` : ""} taşındı.`
      : "Hiçbir abonelik taşınmadı.";

  if (skipped.length > 0) {
    const parts = skipGroups.map((g) => `${g.count} abonelik: ${g.reason}`);
    message += ` ${parts.join(" · ")}`;
  }

  return {
    migratedCount,
    skippedCount: skipped.length,
    message,
    skipGroups,
  };
}

export function formatMigrationResult(
  migrated: string[],
  skipped: MigrationSkippedItem[],
  targetPlanName?: string
): MigrationResult {
  return {
    migrated,
    skipped,
    summary: buildMigrationSummary(migrated.length, skipped, targetPlanName),
  };
}

export async function listMigrationEligibleTargetPlans(sourcePlanId: string) {
  const plans = await db.membershipPlan.findMany({
    where: {
      planStatus: "ACTIVE",
      isActive: true,
      id: { not: sourcePlanId },
    },
    select: {
      id: true,
      name: true,
      code: true,
      defaultCurrency: true,
      currency: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const result = [];
  for (const plan of plans) {
    const activeByPeriod = await loadTargetActivePricesByPeriod(plan.id);
    const activePrices = [...activeByPeriod.values()];
    if (activePrices.length === 0) continue;
    result.push({
      id: plan.id,
      name: plan.name,
      code: plan.code,
      currency: plan.defaultCurrency || plan.currency,
      activePrices,
    });
  }
  return result;
}

export async function listArchivedPlanSubscribers(
  sourcePlanId: string,
  opts?: { search?: string }
) {
  const subscriptions = await db.companySubscription.findMany({
    where: {
      planId: sourcePlanId,
      status: { in: [...ACTIVE_SUB_STATUSES, "PAST_DUE", "GRACE_PERIOD"] },
      ...(opts?.search?.trim()
        ? { company: { name: { contains: opts.search.trim(), mode: "insensitive" } } }
        : {}),
    },
    select: {
      id: true,
      companyId: true,
      status: true,
      billingInterval: true,
      currentPeriodEnd: true,
      lockedPriceMinor: true,
      lockedListPriceMinor: true,
      lockedPlanPriceId: true,
      lockedPlanPrice: { select: { billingInterval: true } },
      nextPlanPriceId: true,
      nextPriceEffectiveAt: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: { currentPeriodEnd: "asc" },
  });

  const companyIds = subscriptions.map((s) => s.companyId);
  const lastPayments =
    companyIds.length > 0
      ? await db.membershipPayment.findMany({
          where: {
            companyId: { in: companyIds },
            status: "PAID",
          },
          orderBy: { paidAt: "desc" },
          distinct: ["companyId"],
          select: {
            companyId: true,
            period: true,
            planPrice: { select: { billingInterval: true } },
          },
        })
      : [];
  const paymentByCompany = new Map(lastPayments.map((p) => [p.companyId, p]));

  return subscriptions.map((sub) => {
    const payment = paymentByCompany.get(sub.companyId);
    const resolvedSourcePeriod = resolveCanonicalBillingPeriod({
      billingInterval: sub.billingInterval,
      lockedPlanPriceBillingInterval: sub.lockedPlanPrice?.billingInterval,
      lastPaymentPeriod: payment?.period,
      lastPaymentPlanPriceBillingInterval: payment?.planPrice?.billingInterval,
    });

    return {
      subscriptionId: sub.id,
      companyId: sub.companyId,
      companyName: sub.company.name,
      status: sub.status,
      billingInterval: sub.billingInterval,
      resolvedSourcePeriod,
      sourcePeriodUnresolved: resolvedSourcePeriod == null,
      currentPeriodEnd: sub.currentPeriodEnd,
      lockedPriceMinor: sub.lockedPriceMinor,
      lockedListPriceMinor: sub.lockedListPriceMinor,
      hasPendingChange: Boolean(sub.nextPlanPriceId),
      nextPriceEffectiveAt: sub.nextPriceEffectiveAt,
    };
  });
}

type SubscriptionMigrationContext = {
  subscription: Awaited<ReturnType<typeof db.companySubscription.findFirst>>;
  companyName: string;
  sourcePeriod: MembershipPeriod | null;
};

async function loadSubscriptionMigrationContexts(
  subscriptionIds: string[],
  sourcePlanId: string
): Promise<Map<string, SubscriptionMigrationContext>> {
  const subscriptions = await db.companySubscription.findMany({
    where: { id: { in: subscriptionIds } },
    include: {
      company: { select: { name: true } },
      lockedPlanPrice: { select: { billingInterval: true, status: true } },
    },
  });

  const companyIds = subscriptions.map((s) => s.companyId);
  const lastPayments =
    companyIds.length > 0
      ? await db.membershipPayment.findMany({
          where: { companyId: { in: companyIds }, status: "PAID" },
          orderBy: { paidAt: "desc" },
          distinct: ["companyId"],
          select: {
            companyId: true,
            period: true,
            planPrice: { select: { billingInterval: true } },
          },
        })
      : [];
  const paymentByCompany = new Map(lastPayments.map((p) => [p.companyId, p]));

  const map = new Map<string, SubscriptionMigrationContext>();
  for (const subscription of subscriptions) {
    const payment = paymentByCompany.get(subscription.companyId);
    const sourcePeriod = resolveCanonicalBillingPeriod({
      billingInterval: subscription.billingInterval,
      lockedPlanPriceBillingInterval: subscription.lockedPlanPrice?.billingInterval,
      lastPaymentPeriod: payment?.period,
      lastPaymentPlanPriceBillingInterval: payment?.planPrice?.billingInterval,
    });
    map.set(subscription.id, {
      subscription,
      companyName: subscription.company.name,
      sourcePeriod,
    });
  }
  return map;
}

function resolveTargetPeriod(
  sourcePeriod: MembershipPeriod | null,
  periodMapping: MigrationPeriodMapping,
  fallbackTargetPeriod?: MembershipPeriod
): MembershipPeriod | null {
  if (sourcePeriod) {
    return periodMapping[sourcePeriod] ?? sourcePeriod;
  }
  return fallbackTargetPeriod ?? null;
}

export async function previewPlanMigration(input: {
  sourcePlanId: string;
  targetPlanId: string;
  subscriptionIds: string[];
  periodMapping: MigrationPeriodMapping;
  fallbackTargetPeriod?: MembershipPeriod;
}) {
  const contexts = await loadSubscriptionMigrationContexts(
    input.subscriptionIds,
    input.sourcePlanId
  );
  const targetPrices = await loadTargetActivePricesByPeriod(input.targetPlanId);

  let wouldMigrate = 0;
  let unresolved = 0;
  const sourcePeriodCounts = new Map<string, number>();

  for (const subscriptionId of input.subscriptionIds) {
    const ctx = contexts.get(subscriptionId);
    if (!ctx?.subscription) continue;
    if (ctx.subscription.planId === input.targetPlanId) continue;
    if (ctx.subscription.planId !== input.sourcePlanId) continue;

    if (ctx.sourcePeriod) {
      sourcePeriodCounts.set(
        ctx.sourcePeriod,
        (sourcePeriodCounts.get(ctx.sourcePeriod) ?? 0) + 1
      );
    } else {
      unresolved += 1;
    }

    const targetPeriod = resolveTargetPeriod(
      ctx.sourcePeriod,
      input.periodMapping,
      input.fallbackTargetPeriod
    );
    if (!targetPeriod) continue;
    if (!targetPrices.has(targetPeriod)) continue;
    wouldMigrate += 1;
  }

  return {
    wouldMigrate,
    wouldSkip: input.subscriptionIds.length - wouldMigrate,
    unresolvedSourcePeriodCount: unresolved,
    sourcePeriodCounts: Object.fromEntries(sourcePeriodCounts),
    targetPeriods: [...targetPrices.entries()].map(([period, price]) => ({
      period,
      salePriceMinor: price.salePriceMinor,
      currency: price.currency,
    })),
  };
}

export async function migrateSubscribersToPlan(input: {
  sourcePlanId: string;
  targetPlanId: string;
  subscriptionIds: string[];
  timing: MigrationTiming;
  periodMapping: MigrationPeriodMapping;
  requestedByUserId: string;
  confirmImmediate?: boolean;
  fallbackTargetPeriod?: MembershipPeriod;
}): Promise<MigrationResult> {
  if (input.timing === "IMMEDIATE" && !input.confirmImmediate) {
    throw new AdminPlanServiceError("İkinci onay gereklidir.", 400);
  }

  if (input.sourcePlanId === input.targetPlanId) {
    throw new AdminPlanServiceError("Hedef plan kaynak plandan farklı olmalı.", 400);
  }

  const [targetPlan, sourcePlan] = await Promise.all([
    db.membershipPlan.findUnique({ where: { id: input.targetPlanId } }),
    db.membershipPlan.findUnique({
      where: { id: input.sourcePlanId },
      select: { name: true },
    }),
  ]);
  if (!targetPlan) throw new AdminPlanServiceError("Hedef plan bulunamadı.", 404);
  if (targetPlan.planStatus !== "ACTIVE" || !targetPlan.isActive) {
    throw new AdminPlanServiceError("Hedef plan aktif değil.", 400);
  }

  const targetPricesByPeriod = await loadTargetActivePricesByPeriod(input.targetPlanId);

  const migrated: string[] = [];
  const skipped: MigrationSkippedItem[] = [];
  const affectedCompanyIds: string[] = [];

  const chunks: string[][] = [];
  for (let i = 0; i < input.subscriptionIds.length; i += MIGRATION_BATCH_SIZE) {
    chunks.push(input.subscriptionIds.slice(i, i + MIGRATION_BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const contexts = await loadSubscriptionMigrationContexts(chunk, input.sourcePlanId);

    for (const subscriptionId of chunk) {
      const ctx = contexts.get(subscriptionId);
      const subscription = ctx?.subscription;
      const companyName = ctx?.companyName;

      if (!subscription) {
        skipped.push({
          subscriptionId,
          reasonCode: "NOT_FOUND",
          reason: SKIP_LABELS.NOT_FOUND,
        });
        continue;
      }

      if (subscription.planId === input.targetPlanId) {
        skipped.push({
          subscriptionId,
          companyName,
          reasonCode: "ALREADY_ON_TARGET",
          reason: SKIP_LABELS.ALREADY_ON_TARGET,
        });
        continue;
      }

      if (subscription.planId !== input.sourcePlanId) {
        skipped.push({
          subscriptionId,
          companyName,
          reasonCode: "NOT_ON_SOURCE",
          reason: SKIP_LABELS.NOT_ON_SOURCE,
        });
        continue;
      }

      const sourcePeriod = ctx?.sourcePeriod ?? null;
      const mappedInterval = resolveTargetPeriod(
        sourcePeriod,
        input.periodMapping,
        input.fallbackTargetPeriod
      );

      if (!sourcePeriod && !input.fallbackTargetPeriod) {
        skipped.push({
          subscriptionId,
          companyName,
          reasonCode: "SOURCE_PERIOD_UNKNOWN",
          reason: SKIP_LABELS.SOURCE_PERIOD_UNKNOWN,
        });
        continue;
      }

      if (!mappedInterval) {
        skipped.push({
          subscriptionId,
          companyName,
          reasonCode: sourcePeriod ? "TARGET_PERIOD_UNMAPPED" : "SOURCE_PERIOD_UNKNOWN",
          reason: sourcePeriod
            ? SKIP_LABELS.TARGET_PERIOD_UNMAPPED
            : SKIP_LABELS.SOURCE_PERIOD_UNKNOWN,
        });
        continue;
      }

      const targetPrice = targetPricesByPeriod.get(mappedInterval);
      if (!targetPrice) {
        const draftOnly = await db.membershipPlanPrice.findFirst({
          where: {
            planId: input.targetPlanId,
            billingInterval: mappedInterval,
            status: "DRAFT",
          },
          select: { id: true },
        });
        skipped.push({
          subscriptionId,
          companyName,
          reasonCode: draftOnly ? "TARGET_PRICE_DRAFT" : "TARGET_PRICE_MISSING",
          reason: draftOnly
            ? `${targetPlan.name} planında ${mappedInterval} fiyatı henüz yayınlanmamış.`
            : `${targetPlan.name} planında aktif ${mappedInterval} fiyatı bulunmuyor.`,
        });
        continue;
      }

      if (input.timing === "AT_RENEWAL") {
        const existingPending = await db.subscriptionPendingChange.findFirst({
          where: {
            subscriptionId,
            status: "PENDING",
            targetPlanId: input.targetPlanId,
            targetPlanPriceId: targetPrice.id,
          },
        });
        if (existingPending) {
          skipped.push({
            subscriptionId,
            companyName,
            reasonCode: "ALREADY_SCHEDULED",
            reason: SKIP_LABELS.ALREADY_SCHEDULED,
          });
          continue;
        }

        try {
          const effectiveAt =
            subscription.currentPeriodEnd ?? subscription.nextBillingAt ?? new Date();
          await schedulePendingChange({
            subscriptionId,
            companyId: subscription.companyId,
            changeType: "PLAN_AND_INTERVAL",
            targetPlanId: input.targetPlanId,
            targetBillingInterval: mappedInterval,
            effectiveAt,
            requestedByUserId: input.requestedByUserId,
            reason: `Plan taşıma: ${sourcePlan?.name ?? input.sourcePlanId} -> ${targetPlan.name}`,
          });
          migrated.push(subscriptionId);
          affectedCompanyIds.push(subscription.companyId);
        } catch (err) {
          skipped.push({
            subscriptionId,
            companyName,
            reasonCode: "MIGRATION_FAILED",
            reason:
              err instanceof Error ? err.message : "Bekleyen değişiklik planlanamadı.",
          });
        }
      } else {
        // IMMEDIATE
        try {
          await db.$transaction(async (tx) => {
            await tx.subscriptionPendingChange.updateMany({
              where: { subscriptionId, status: "PENDING" },
              data: { status: "CANCELLED", cancelledAt: new Date() },
            });

            await tx.companySubscription.update({
              where: { id: subscriptionId },
              data: {
                planId: input.targetPlanId,
                billingInterval: mappedInterval,
                nextPlanPriceId: targetPrice.id,
                nextPriceEffectiveAt:
                  subscription.currentPeriodEnd ?? subscription.nextBillingAt ?? null,
              },
            });

            await logAdminPlanAudit({
              userId: input.requestedByUserId,
              action: "PLAN_SUBSCRIBER_MIGRATED_IMMEDIATE",
              planId: input.targetPlanId,
              entityType: "MembershipPlan",
              entityId: subscriptionId,
              displayMessage: `${companyName ?? "Firma"} aboneliği ${targetPlan.name} planına hemen taşındı.`,
              metadata: {
                sourcePlanId: input.sourcePlanId,
                targetPlanId: input.targetPlanId,
                subscriptionId,
                targetBillingInterval: mappedInterval,
                companyName,
              },
              tx,
            });
          });
          migrated.push(subscriptionId);
          affectedCompanyIds.push(subscription.companyId);
        } catch (err) {
          skipped.push({
            subscriptionId,
            companyName,
            reasonCode: "MIGRATION_FAILED",
            reason: err instanceof Error ? err.message : "Taşıma başarısız.",
          });
        }
      }
    }
  }

  invalidateAdminPlanEntitlementCaches(input.targetPlanId);
  invalidateAdminPlanCaches(input.sourcePlanId);
  invalidateAdminPlanCaches(input.targetPlanId);
  for (const companyId of affectedCompanyIds) {
    invalidateAdminSubscriptionCaches(undefined, companyId);
  }

  return formatMigrationResult(migrated, skipped, targetPlan.name);
}
