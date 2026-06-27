import "server-only";
import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  COLLECTION_METRIC_POLICY,
  IS_NOT_TRIAL_PLACEHOLDER,
  REFUND_METRIC_POLICY,
  REVENUE_ELIGIBLE_WHERE,
} from "@/lib/admin/payments/admin-payment-metric-definitions";
import { buildMetricHref } from "@/lib/admin/payments/admin-payment-filter-utils";

export type AdminPaymentMetrics = {
  total: number;
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
  partiallyRefunded: number;
  cancelled: number;
  callbackWaiting: number;
  callbackIssues: number;
  providerMismatch: number;
  orphanPayments: number;
  failedLast24h: number;
  recurringFailed: number;
  collectedByCurrency: Record<string, number>;
  refundedByCurrency: Record<string, number>;
  collectedThisMonthByCurrency: Record<string, number>;
  refundedThisMonthByCurrency: Record<string, number>;
  collectionPolicy: string;
  refundPolicy: string;
  metricHrefs: Record<string, string>;
};

function minorToMajor(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cur, minor] of Object.entries(map)) out[cur] = minor / 100;
  return out;
}

export async function getAdminPaymentMetrics(): Promise<AdminPaymentMetrics> {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const callbackIssueWhere: Prisma.MembershipPaymentWhereInput = {
    ...IS_NOT_TRIAL_PLACEHOLDER,
    status: { in: ["WAIT_CALLBACK", "UNKNOWN"] },
    callbackReceivedAt: null,
    createdAt: { lte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
  };

  const [
    total,
    paid,
    pending,
    failed,
    refunded,
    partiallyRefunded,
    cancelled,
    callbackWaiting,
    callbackIssues,
    orphanPayments,
    failedLast24h,
    paidRows,
    paidMonthRows,
    succeededRefunds,
    succeededRefundsMonth,
  ] = await Promise.all([
    db.membershipPayment.count({ where: IS_NOT_TRIAL_PLACEHOLDER }),
    db.membershipPayment.count({ where: { status: "PAID", ...IS_NOT_TRIAL_PLACEHOLDER } }),
    db.membershipPayment.count({
      where: {
        status: { in: ["PENDING", "FORM_READY", "WAIT_CALLBACK", "UNKNOWN"] },
        ...IS_NOT_TRIAL_PLACEHOLDER,
      },
    }),
    db.membershipPayment.count({ where: { status: "FAILED", ...IS_NOT_TRIAL_PLACEHOLDER } }),
    db.membershipPayment.count({ where: { status: "REFUNDED", ...IS_NOT_TRIAL_PLACEHOLDER } }),
    db.membershipPayment.count({
      where: { status: "PARTIALLY_REFUNDED", ...IS_NOT_TRIAL_PLACEHOLDER },
    }),
    db.membershipPayment.count({ where: { status: "CANCELLED", ...IS_NOT_TRIAL_PLACEHOLDER } }),
    db.membershipPayment.count({
      where: {
        status: { in: ["WAIT_CALLBACK", "UNKNOWN", "PENDING"] },
        callbackReceivedAt: null,
        ...IS_NOT_TRIAL_PLACEHOLDER,
      },
    }),
    db.membershipPayment.count({ where: callbackIssueWhere }),
    db.membershipPayment.count({
      where: { subscriptionId: null, ...IS_NOT_TRIAL_PLACEHOLDER },
    }),
    db.membershipPayment.count({
      where: { status: "FAILED", failedAt: { gte: last24h }, ...IS_NOT_TRIAL_PLACEHOLDER },
    }),
    db.membershipPayment.findMany({
      where: REVENUE_ELIGIBLE_WHERE,
      select: { amountMinor: true, currency: true },
    }),
    db.membershipPayment.findMany({
      where: {
        ...REVENUE_ELIGIBLE_WHERE,
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      select: { amountMinor: true, currency: true },
    }),
    db.paymentRefund.findMany({
      where: { status: "SUCCEEDED", completedAt: { not: null } },
      select: { amountMinor: true, currency: true },
    }),
    db.paymentRefund.findMany({
      where: {
        status: "SUCCEEDED",
        completedAt: { gte: monthStart, lte: monthEnd },
      },
      select: { amountMinor: true, currency: true },
    }),
  ]);

  const sumByCurrency = (rows: Array<{ amountMinor: number | null; currency: string }>) => {
    const map: Record<string, number> = {};
    for (const row of rows) {
      if (row.amountMinor == null) continue;
      map[row.currency] = (map[row.currency] ?? 0) + row.amountMinor;
    }
    return map;
  };

  const collectedByCurrency = minorToMajor(sumByCurrency(paidRows));
  const collectedThisMonthByCurrency = minorToMajor(sumByCurrency(paidMonthRows));
  const refundedByCurrency = minorToMajor(sumByCurrency(succeededRefunds));
  const refundedThisMonthByCurrency = minorToMajor(sumByCurrency(succeededRefundsMonth));

  return {
    total,
    paid,
    pending,
    failed,
    refunded,
    partiallyRefunded,
    cancelled,
    callbackWaiting,
    callbackIssues,
    providerMismatch: 0,
    orphanPayments,
    failedLast24h,
    recurringFailed: 0,
    collectedByCurrency,
    refundedByCurrency,
    collectedThisMonthByCurrency,
    refundedThisMonthByCurrency,
    collectionPolicy: COLLECTION_METRIC_POLICY,
    refundPolicy: REFUND_METRIC_POLICY,
    metricHrefs: {
      paid: buildMetricHref({ status: "PAID" }),
      pending: buildMetricHref({ status: "PENDING" }),
      failed: buildMetricHref({ status: "FAILED" }),
      refunded: buildMetricHref({ refund: "FULL" }),
      partial: buildMetricHref({ refund: "PARTIAL" }),
      callbackIssues: buildMetricHref({ issue: "callback_missing" }),
      orphan: buildMetricHref({ issue: "orphan" }),
      failed24h: buildMetricHref({ status: "FAILED", dateRange: "LAST_24H" }),
    },
  };
}
