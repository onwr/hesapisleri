import "server-only";

import type {
  MembershipPeriod,
  Prisma,
  SubscriptionPendingChangeType,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";

type Tx = Prisma.TransactionClient;

export type RenewalTarget = {
  planId: string;
  billingInterval: MembershipPeriod;
  pendingChangeId?: string;
};

export async function getActivePendingChange(subscriptionId: string) {
  return db.subscriptionPendingChange.findFirst({
    where: { subscriptionId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveRenewalTarget(
  subscription: {
    id: string;
    companyId: string;
    planId: string | null;
    billingInterval: MembershipPeriod | null;
    currentPeriodEnd: Date | null;
    nextBillingAt: Date | null;
  },
  referenceDate = new Date()
): Promise<RenewalTarget | null> {
  if (!subscription.planId) return null;

  const pending = await getActivePendingChange(subscription.id);
  const effectiveAt = subscription.currentPeriodEnd ?? subscription.nextBillingAt;

  if (
    pending &&
    effectiveAt &&
    pending.effectiveAt.getTime() <= effectiveAt.getTime() &&
    pending.effectiveAt.getTime() <= referenceDate.getTime() + 86_400_000
  ) {
    return {
      planId: pending.targetPlanId ?? subscription.planId,
      billingInterval:
        pending.targetBillingInterval ??
        subscription.billingInterval ??
        "MONTHLY",
      pendingChangeId: pending.id,
    };
  }

  return {
    planId: subscription.planId,
    billingInterval: subscription.billingInterval ?? "MONTHLY",
  };
}

export async function schedulePendingChange(input: {
  subscriptionId: string;
  companyId: string;
  changeType: SubscriptionPendingChangeType;
  targetPlanId?: string | null;
  targetBillingInterval?: MembershipPeriod | null;
  effectiveAt: Date;
  requestedByUserId: string;
  reason: string;
}) {
  const existing = await getActivePendingChange(input.subscriptionId);
  if (existing) {
    throw new Error("Bu abonelikte zaten bekleyen bir değişiklik var.");
  }

  const subscription = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
  });
  if (!subscription?.planId) {
    throw new Error("Plan atanmamış abonelik.");
  }

  const planId = input.targetPlanId ?? subscription.planId;
  const interval =
    input.targetBillingInterval ?? subscription.billingInterval ?? "MONTHLY";

  const resolved = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId,
    billingInterval: interval,
    isRenewal: true,
  });

  const activePrice = await db.membershipPlanPrice.findFirst({
    where: { planId, billingInterval: interval, status: "ACTIVE" },
    orderBy: { version: "desc" },
  });

  const change = await db.subscriptionPendingChange.create({
    data: {
      subscriptionId: input.subscriptionId,
      changeType: input.changeType,
      targetPlanId: input.targetPlanId,
      targetPlanPriceId: activePrice?.id ?? null,
      targetBillingInterval: input.targetBillingInterval,
      effectiveAt: input.effectiveAt,
      requestedByUserId: input.requestedByUserId,
      reason: input.reason,
      estimatedPriceMinor: resolved.totalMinor,
    },
  });

  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      nextPlanPriceId: activePrice?.id ?? null,
      nextPriceEffectiveAt: input.effectiveAt,
    },
  });

  const outboxType =
    input.changeType === "INTERVAL"
      ? "SUBSCRIPTION_INTERVAL_CHANGE_SCHEDULED"
      : "SUBSCRIPTION_PLAN_CHANGE_SCHEDULED";

  await enqueueBillingOutboxEvent({
    companyId: input.companyId,
    type: outboxType,
    aggregateType: "SubscriptionPendingChange",
    aggregateId: change.id,
    payload: {
      subscriptionId: input.subscriptionId,
      changeType: input.changeType,
      effectiveAt: input.effectiveAt.toISOString(),
    },
  });

  return change;
}

export async function cancelPendingChange(input: {
  subscriptionId: string;
  companyId: string;
  actorUserId: string;
  reason?: string;
}) {
  const processingRun = await db.subscriptionBillingRun.findFirst({
    where: {
      subscriptionId: input.subscriptionId,
      status: "PROCESSING",
    },
  });
  if (processingRun) {
    throw new Error("Devam eden faturalandırma işlemi varken iptal edilemez.");
  }

  const pending = await getActivePendingChange(input.subscriptionId);
  if (!pending) {
    throw new Error("Bekleyen değişiklik bulunamadı.");
  }

  const updated = await db.subscriptionPendingChange.update({
    where: { id: pending.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      nextPlanPriceId: null,
      nextPriceEffectiveAt: null,
    },
  });

  await enqueueBillingOutboxEvent({
    companyId: input.companyId,
    type: "SUBSCRIPTION_CANCEL_REVOKED",
    aggregateType: "SubscriptionPendingChange",
    aggregateId: pending.id,
    payload: {
      subscriptionId: input.subscriptionId,
      cancelledBy: input.actorUserId,
      reason: input.reason ?? null,
    },
  });

  return updated;
}

/** PayTR callback PAID sonrası — ödeme başarılıysa pending change uygula */
export async function applyPendingChangeAfterSuccessfulPayment(
  input: {
    subscriptionId: string;
    companyId: string;
    paymentId: string;
  },
  tx: Tx
) {
  const pending = await tx.subscriptionPendingChange.findFirst({
    where: { subscriptionId: input.subscriptionId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) return null;

  const subscription = await tx.companySubscription.findUnique({
    where: { id: input.subscriptionId },
  });
  if (!subscription) return null;

  const effectiveAt = subscription.currentPeriodEnd ?? subscription.nextBillingAt;
  if (!effectiveAt || pending.effectiveAt.getTime() > effectiveAt.getTime()) {
    return null;
  }

  const nextPlanId = pending.targetPlanId ?? subscription.planId;
  const nextInterval =
    pending.targetBillingInterval ?? subscription.billingInterval;

  await tx.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      planId: nextPlanId ?? undefined,
      billingInterval: nextInterval ?? undefined,
      nextPlanPriceId: null,
      nextPriceEffectiveAt: null,
    },
  });

  await tx.subscriptionPendingChange.update({
    where: { id: pending.id },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
    },
  });

  const outboxType =
    pending.changeType === "INTERVAL"
      ? "SUBSCRIPTION_INTERVAL_CHANGED"
      : "SUBSCRIPTION_PLAN_CHANGED";

  await enqueueBillingOutboxEvent(
    {
      companyId: input.companyId,
      type: outboxType,
      aggregateType: "CompanySubscription",
      aggregateId: input.subscriptionId,
      payload: {
        pendingChangeId: pending.id,
        paymentId: input.paymentId,
      },
    },
    tx
  );

  return pending;
}
