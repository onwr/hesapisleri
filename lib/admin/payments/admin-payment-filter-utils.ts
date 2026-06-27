import type { Prisma } from "@prisma/client";
import type { AdminPaymentListQuery } from "@/lib/admin/payments/admin-payment-schemas";
import {
  IS_NOT_TRIAL_PLACEHOLDER,
  TRIAL_PLACEHOLDER_PROVIDER,
} from "@/lib/admin/payments/admin-payment-metric-definitions";

function dateRangeBounds(query: AdminPaymentListQuery): { gte?: Date; lte?: Date } | null {
  const now = new Date();
  if (query.dateRange === "CUSTOM") {
    const gte = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const lte = query.dateTo ? new Date(query.dateTo) : undefined;
    if (!gte && !lte) return null;
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }
  if (query.dateRange === "ALL") return null;
  const start = new Date(now);
  const end = new Date(now);
  switch (query.dateRange) {
    case "TODAY":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return { gte: start, lte: end };
    case "LAST_24H":
      return { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
    case "LAST_7D":
      return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
    case "LAST_30D":
      return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
    case "THIS_MONTH":
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    case "LAST_MONTH": {
      const gte = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lte = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { gte, lte };
    }
    default:
      return null;
  }
}

export function buildAdminPaymentListWhere(
  query: AdminPaymentListQuery
): Prisma.MembershipPaymentWhereInput {
  const where: Prisma.MembershipPaymentWhereInput = {};

  if (query.paymentId) where.id = query.paymentId;
  if (query.companyId) where.companyId = query.companyId;
  if (query.subscriptionId) where.subscriptionId = query.subscriptionId;
  if (query.merchantOid) where.merchantOid = { contains: query.merchantOid, mode: "insensitive" };

  if (query.status !== "ALL") {
    if (query.status === "REFUNDED") {
      where.status = { in: ["REFUNDED", "PARTIALLY_REFUNDED"] };
    } else {
      where.status = query.status;
    }
  }

  if (query.provider === "TRIAL_PLACEHOLDER") {
    where.provider = TRIAL_PLACEHOLDER_PROVIDER;
  } else if (query.provider !== "ALL") {
    where.providerEnum = query.provider;
  }

  if (query.currency !== "ALL") where.currency = query.currency;

  const dr = dateRangeBounds(query);
  if (dr) where.createdAt = dr;

  if (query.refund === "NONE") {
    where.status = { notIn: ["REFUNDED", "PARTIALLY_REFUNDED"] };
    where.refundedAmountMinor = { lte: 0 };
  } else if (query.refund === "PARTIAL") {
    where.status = "PARTIALLY_REFUNDED";
  } else if (query.refund === "FULL") {
    where.status = "REFUNDED";
  } else if (query.refund === "PENDING") {
    where.refunds = { some: { status: { in: ["REQUESTED", "PROCESSING", "UNKNOWN"] } } };
  } else if (query.refund === "FAILED") {
    where.refunds = { some: { status: "FAILED" } };
  }

  if (query.callback === "RECEIVED") where.callbackReceivedAt = { not: null };
  else if (query.callback === "WAITING") {
    where.callbackReceivedAt = null;
    where.status = { in: ["WAIT_CALLBACK", "PENDING", "UNKNOWN"] };
  } else if (query.callback === "MISSING") {
    where.callbackReceivedAt = null;
    where.providerEnum = "PAYTR";
    where.status = { in: ["PAID", "FAILED", "WAIT_CALLBACK"] };
  }

  if (query.subscription === "LINKED") where.subscriptionId = { not: null };
  else if (query.subscription === "UNLINKED") where.subscriptionId = null;

  if (query.issue === "callback_missing") {
    where.callbackReceivedAt = null;
    where.providerEnum = "PAYTR";
    where.createdAt = { lte: new Date(Date.now() - 2 * 60 * 60 * 1000) };
  } else if (query.issue === "orphan") {
    where.subscriptionId = null;
    where.NOT = { provider: TRIAL_PLACEHOLDER_PROVIDER };
  } else if (query.issue === "pending_timeout") {
    where.status = { in: ["PENDING", "WAIT_CALLBACK", "UNKNOWN"] };
    where.createdAt = { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }

  if (query.q && query.q.trim().length >= 2) {
    const q = query.q.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { merchantOid: { contains: q, mode: "insensitive" } },
      { providerPaymentId: { contains: q, mode: "insensitive" } },
      { paymentRef: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { companyId: { contains: q, mode: "insensitive" } },
      { subscriptionId: { contains: q, mode: "insensitive" } },
      { plan: { name: { contains: q, mode: "insensitive" } } },
      {
        company: {
          users: {
            some: {
              isOwner: true,
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      },
      { refunds: { some: { referenceNo: { contains: q, mode: "insensitive" } } } },
    ];
  }

  return where;
}

export function buildAdminPaymentOrderBy(
  query: AdminPaymentListQuery
): Prisma.MembershipPaymentOrderByWithRelationInput {
  const dir = query.sortDir;
  switch (query.sortBy) {
    case "amount":
      return { amountMinor: dir };
    case "companyName":
      return { company: { name: dir } };
    case "status":
      return { status: dir };
    case "callbackReceivedAt":
      return { callbackReceivedAt: dir };
    case "paidAt":
      return { paidAt: dir };
    case "refundedAmountMinor":
      return { refundedAmountMinor: dir };
    default:
      return { createdAt: dir };
  }
}

export function buildMetricHref(params: Record<string, string>): string {
  const sp = new URLSearchParams(params);
  return `/admin/payments?${sp.toString()}`;
}
