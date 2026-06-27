import "server-only";
import { db } from "@/lib/prisma";
import {
  detectPaymentIssues,
  getPaymentIssueLabel,
  ISSUE_TAB_LINKS,
  readSnapshotTotalMinor,
} from "@/lib/admin/payments/admin-payment-issue-service";
import {
  buildPaymentTimelineEvents,
  hasDuplicateCallbackSignal,
  serializeWebhookEvent,
  WEBHOOK_SAFE_SELECT,
} from "@/lib/admin/payments/admin-payment-event-service";
import {
  evaluateRefundUiGate,
  reconcileRefundedAmountMinor,
  serializeRefundRows,
  sumCompletedRefundsMinor,
} from "@/lib/admin/payments/admin-payment-refund-service";
import {
  formatPaymentProviderLabel,
  getCallbackStatusLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  isTrialPlaceholderPayment,
  maskProviderRef,
  serializePaymentErrorSummary,
} from "@/lib/admin/payments/admin-payment-serializers";
import { listAdminPaymentNotes, countAdminPaymentNotes } from "@/lib/admin/payments/admin-payment-note-service";
import type { AdminPaymentTab } from "@/lib/admin/payments/admin-payment-schemas";
import { resolvePaymentTab } from "@/lib/admin/payments/admin-payment-schemas";

export { resolvePaymentTab };
export type { AdminPaymentTab };

const paymentHeaderSelect = {
  id: true,
  companyId: true,
  subscriptionId: true,
  planId: true,
  merchantOid: true,
  providerEnum: true,
  provider: true,
  providerPaymentId: true,
  providerStatus: true,
  amount: true,
  amountMinor: true,
  currency: true,
  refundedAmountMinor: true,
  status: true,
  type: true,
  paidAt: true,
  failedAt: true,
  callbackReceivedAt: true,
  createdAt: true,
  failedReasonCode: true,
  failedReasonMessage: true,
  priceSnapshot: true,
  company: { select: { id: true, name: true, status: true } },
  plan: { select: { id: true, name: true, code: true } },
  refunds: {
    select: {
      id: true,
      referenceNo: true,
      amountMinor: true,
      currency: true,
      status: true,
      reason: true,
      completedAt: true,
      failedAt: true,
      failureMessage: true,
      requestedAt: true,
      createdAt: true,
    },
  },
} as const;

async function loadPaymentCore(paymentId: string) {
  return db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: paymentHeaderSelect,
  });
}

async function loadSubscription(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return null;
  return db.companySubscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, status: true, companyId: true, currentPeriodEnd: true },
  });
}

export async function getAdminPaymentHeader(paymentId: string) {
  const p = await loadPaymentCore(paymentId);
  if (!p) return null;

  const subscription = await loadSubscription(p.subscriptionId);

  const refundRows = p.refunds.map((r) => ({
    status: r.status,
    amountMinor: r.amountMinor,
    currency: r.currency,
    completedAt: r.completedAt,
  }));
  const completedRefundMinor = sumCompletedRefundsMinor(refundRows, p.currency);

  const webhooks = await db.paymentWebhookEvent.findMany({
    where: { paymentId },
    select: { attemptCount: true, signatureValid: true },
  });

  const failedOutbox = await db.billingOutboxEvent.count({
    where: {
      aggregateType: "MembershipPayment",
      aggregateId: paymentId,
      status: "FAILED",
    },
  });

  const webhookInvalid = webhooks.some((w) => w.signatureValid === false);
  const webhookDuplicate = hasDuplicateCallbackSignal(webhooks);

  const issues = detectPaymentIssues({
    payment: p,
    subscription,
    completedRefundMinor,
    hasFailedOutbox: failedOutbox > 0,
    webhookInvalidSignature: webhookInvalid,
    webhookDuplicateAttempt: webhookDuplicate,
  });

  const noteCount = await countAdminPaymentNotes(paymentId);
  const amountMinor = p.amountMinor ?? Math.round(Number(p.amount) * 100);

  return {
    id: p.id,
    companyId: p.companyId,
    companyName: p.company.name,
    companyStatus: p.company.status,
    subscriptionId: p.subscriptionId,
    subscriptionStatus: subscription?.status ?? null,
    planName: p.plan?.name ?? null,
    merchantOidMasked: maskProviderRef(p.merchantOid),
    provider: formatPaymentProviderLabel(p.providerEnum, p.provider),
    providerEnum: p.providerEnum,
    isTrialPlaceholder: isTrialPlaceholderPayment(p),
    amountMinor,
    netMinor: Math.max(0, amountMinor - completedRefundMinor),
    refundedMinor: completedRefundMinor,
    currency: p.currency,
    status: p.status,
    statusLabel: getPaymentStatusLabel(p.status),
    statusClass: getPaymentStatusClass(p.status),
    callbackStatus: getCallbackStatusLabel({
      callbackReceivedAt: p.callbackReceivedAt,
      status: p.status,
    }),
    errorSummary: serializePaymentErrorSummary(p),
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    noteCount,
    issues: issues.map((code) => ({
      code,
      label: getPaymentIssueLabel(code),
      tab: ISSUE_TAB_LINKS[code] ?? "overview",
    })),
    companyHref: `/admin/companies/${p.companyId}`,
    subscriptionHref: p.subscriptionId ? `/admin/subscriptions/${p.subscriptionId}` : null,
  };
}

export async function getPaymentOverviewTab(paymentId: string) {
  const p = await loadPaymentCore(paymentId);
  if (!p) return null;

  const subscription = await loadSubscription(p.subscriptionId);

  const snapTotal = readSnapshotTotalMinor(p.priceSnapshot);
  const amountMinor = p.amountMinor ?? Math.round(Number(p.amount) * 100);
  const refundReconcile = reconcileRefundedAmountMinor({
    payment: {
      amountMinor: p.amountMinor,
      currency: p.currency,
      refundedAmountMinor: p.refundedAmountMinor,
      status: p.status,
    },
    refunds: p.refunds.map((r) => ({
      status: r.status,
      amountMinor: r.amountMinor,
      currency: r.currency,
      completedAt: r.completedAt,
    })),
  });

  return {
    payment: {
      id: p.id,
      type: p.type,
      status: p.status,
      amountMinor,
      currency: p.currency,
      provider: formatPaymentProviderLabel(p.providerEnum, p.provider),
      providerStatus: p.providerStatus,
      providerPaymentIdMasked: maskProviderRef(p.providerPaymentId),
      merchantOidMasked: maskProviderRef(p.merchantOid),
      paidAt: p.paidAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
      callbackReceivedAt: p.callbackReceivedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      errorSummary: serializePaymentErrorSummary(p),
    },
    pricing: {
      snapshotTotalMinor: snapTotal,
      amountMatchesSnapshot: snapTotal == null ? null : snapTotal === amountMinor,
      priceSnapshot: p.priceSnapshot,
    },
    refunds: refundReconcile,
    company: p.company,
    plan: p.plan,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          href: `/admin/subscriptions/${subscription.id}`,
        }
      : null,
  };
}

export async function getPaymentProviderTab(paymentId: string) {
  const p = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      merchantOid: true,
      providerEnum: true,
      providerStatus: true,
      callbackReceivedAt: true,
      status: true,
    },
  });
  if (!p) return null;

  const webhooks = await db.paymentWebhookEvent.findMany({
    where: { paymentId },
    select: WEBHOOK_SAFE_SELECT,
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  const reconciliations = await db.paymentReconciliation.findMany({
    where: { paymentId },
    orderBy: { checkedAt: "desc" },
    take: 20,
    select: {
      id: true,
      localStatus: true,
      providerStatus: true,
      localAmountMinor: true,
      providerAmountMinor: true,
      discrepancyType: true,
      checkedAt: true,
      resolvedAt: true,
    },
  });

  return {
    providerEnum: p.providerEnum,
    providerStatus: p.providerStatus,
    merchantOidMasked: maskProviderRef(p.merchantOid),
    callbackStatus: getCallbackStatusLabel({
      callbackReceivedAt: p.callbackReceivedAt,
      status: p.status,
    }),
    webhooks: webhooks.map(serializeWebhookEvent),
    reconciliations: reconciliations.map((r) => ({
      ...r,
      checkedAt: r.checkedAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    })),
    duplicateCallbackNote:
      "Callback idempotent işleniyor; tekrar sayısı yalnız attemptCount>1 ile gösterilir.",
  };
}

export async function getPaymentSubscriptionTab(paymentId: string) {
  const p = await loadPaymentCore(paymentId);
  if (!p) return null;

  if (!p.subscriptionId) {
    return {
      linked: false,
      subscription: null,
      billingRun: null,
    };
  }

  const [sub, billingRun] = await Promise.all([
    db.companySubscription.findUnique({
      where: { id: p.subscriptionId },
      select: {
        id: true,
        status: true,
        billingInterval: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        cancelAtPeriodEnd: true,
        companyId: true,
        plan: { select: { name: true, code: true } },
      },
    }),
    db.subscriptionBillingRun.findFirst({
      where: { paymentId },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        scheduledAt: true,
      },
    }),
  ]);

  return {
    linked: true,
    subscription: sub
      ? {
          ...sub,
          currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
          href: `/admin/subscriptions/${sub.id}`,
          companyMatch: sub.companyId === p.companyId,
        }
      : null,
    billingRun: billingRun
      ? {
          ...billingRun,
          periodStart: billingRun.periodStart.toISOString(),
          periodEnd: billingRun.periodEnd.toISOString(),
          scheduledAt: billingRun.scheduledAt.toISOString(),
        }
      : null,
  };
}

export async function getPaymentRefundsTab(paymentId: string, isSuperAdmin: boolean) {
  const p = await loadPaymentCore(paymentId);
  if (!p) return null;

  const refundRows = p.refunds.map((r) => ({
    status: r.status,
    amountMinor: r.amountMinor,
    currency: r.currency,
    completedAt: r.completedAt,
  }));

  const gate = evaluateRefundUiGate({
    isSuperAdmin,
    paymentStatus: p.status,
    providerEnum: p.providerEnum,
    merchantOid: p.merchantOid,
    amountMinor: p.amountMinor,
    currency: p.currency,
    refunds: refundRows,
    hasAuditOnRefund: true,
    hasCacheInvalidationOnRefund: true,
  });

  const reconcile = reconcileRefundedAmountMinor({
    payment: {
      amountMinor: p.amountMinor,
      currency: p.currency,
      refundedAmountMinor: p.refundedAmountMinor,
      status: p.status,
    },
    refunds: refundRows,
  });

  return {
    refunds: serializeRefundRows(p.refunds),
    reconcile,
    gate,
    readOnly: !gate.canInitiate,
  };
}

export async function getPaymentEventsTab(paymentId: string) {
  const p = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      paidAt: true,
      failedAt: true,
      callbackReceivedAt: true,
      companyId: true,
    },
  });
  if (!p) return null;

  const [webhooks, outbox, refunds, activity] = await Promise.all([
    db.paymentWebhookEvent.findMany({
      where: { paymentId },
      select: WEBHOOK_SAFE_SELECT,
    }),
    db.billingOutboxEvent.findMany({
      where: { aggregateType: "MembershipPayment", aggregateId: paymentId },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        processedAt: true,
        lastError: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.paymentRefund.findMany({
      where: { paymentId },
      select: {
        id: true,
        status: true,
        amountMinor: true,
        currency: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    db.activityLog.findMany({
      where: {
        companyId: p.companyId,
        OR: [
          { message: { contains: paymentId } },
          { module: "admin-payments" },
        ],
      },
      select: { id: true, action: true, message: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const events = buildPaymentTimelineEvents({
    payment: p,
    webhooks,
    outbox,
    refunds,
    activity,
  });

  return { events, outboxCount: outbox.length };
}

export async function getPaymentActivityTab(paymentId: string, page = 1, pageSize = 30) {
  const p = await db.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { companyId: true },
  });
  if (!p) return null;

  const where = {
    companyId: p.companyId,
    OR: [{ message: { contains: paymentId } }, { module: "admin-payments" }],
  };

  const [total, items] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        message: true,
        module: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: items.map((i) => ({
      id: i.id,
      action: i.action,
      message: i.message,
      module: i.module,
      user: i.user,
      createdAt: i.createdAt.toISOString(),
    })),
  };
}

export async function getPaymentNotesTab(paymentId: string) {
  return listAdminPaymentNotes(paymentId);
}
