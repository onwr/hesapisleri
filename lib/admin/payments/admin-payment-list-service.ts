import "server-only";
import { db } from "@/lib/prisma";
import type { AdminPaymentListQuery } from "@/lib/admin/payments/admin-payment-schemas";
import {
  buildAdminPaymentListWhere,
  buildAdminPaymentOrderBy,
} from "@/lib/admin/payments/admin-payment-filter-utils";
import {
  detectPaymentIssues,
  getPaymentIssueLabel,
  type PaymentIssue,
} from "@/lib/admin/payments/admin-payment-issue-service";
import { sumCompletedRefundsMinor } from "@/lib/admin/payments/admin-payment-refund-utils";
import {
  formatPaymentProviderLabel,
  getCallbackStatusLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
  maskProviderRef,
  serializePaymentErrorSummary,
} from "@/lib/admin/payments/admin-payment-serializers";

const listSelect = {
  id: true,
  companyId: true,
  subscriptionId: true,
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
  company: { select: { id: true, name: true } },
  plan: { select: { id: true, name: true } },
  refunds: {
    select: { status: true, amountMinor: true, currency: true, completedAt: true },
  },
} as const;

export async function getAdminPaymentList(query: AdminPaymentListQuery) {
  const where = buildAdminPaymentListWhere(query);
  const orderBy = buildAdminPaymentOrderBy(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    db.membershipPayment.count({ where }),
    db.membershipPayment.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      select: listSelect,
    }),
  ]);

  const subscriptionIds = [
    ...new Set(items.map((p) => p.subscriptionId).filter((id): id is string => !!id)),
  ];
  const subscriptions = subscriptionIds.length
    ? await db.companySubscription.findMany({
        where: { id: { in: subscriptionIds } },
        select: { id: true, status: true, companyId: true },
      })
    : [];
  const subscriptionById = new Map(subscriptions.map((s) => [s.id, s]));

  const rows = items.map((p) => {
    const subscription = p.subscriptionId ? subscriptionById.get(p.subscriptionId) ?? null : null;

    const completedRefundMinor = sumCompletedRefundsMinor(
      p.refunds.map((r) => ({
        status: r.status,
        amountMinor: r.amountMinor,
        currency: r.currency,
        completedAt: r.completedAt,
      })),
      p.currency
    );
    const issues = detectPaymentIssues({
      payment: {
        ...p,
        companyId: p.companyId,
        createdAt: p.createdAt,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            companyId: subscription.companyId,
            status: subscription.status,
          }
        : null,
      completedRefundMinor,
      hasFailedOutbox: false,
    });

    const amountMinor = p.amountMinor ?? Math.round(Number(p.amount) * 100);
    const netMinor = Math.max(0, amountMinor - completedRefundMinor);

    return {
      id: p.id,
      shortId: p.id.slice(0, 10),
      merchantOidMasked: maskProviderRef(p.merchantOid),
      provider: formatPaymentProviderLabel(p.providerEnum, p.provider),
      providerEnum: p.providerEnum,
      company: p.company,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            href: `/admin/subscriptions/${subscription.id}`,
          }
        : null,
      planName: p.plan?.name ?? null,
      amountMinor,
      netMinor,
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
      issues: issues.map((code) => ({
        code,
        label: getPaymentIssueLabel(code),
      })),
      paidAt: p.paidAt?.toISOString() ?? null,
      callbackReceivedAt: p.callbackReceivedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      detailHref: `/admin/payments/${p.id}`,
      companyHref: `/admin/companies/${p.companyId}`,
    };
  });

  return {
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    items: rows,
  };
}

export async function exportAdminPaymentsCsv(query: AdminPaymentListQuery): Promise<string> {
  const list = await getAdminPaymentList({ ...query, page: 1, pageSize: 100 });
  const header = [
    "paymentId",
    "company",
    "subscriptionId",
    "plan",
    "amountMinor",
    "currency",
    "status",
    "provider",
    "merchantOid",
    "createdAt",
    "paidAt",
    "refundSummary",
    "issues",
  ];
  const lines = [header.join(",")];
  for (const row of list.items) {
    lines.push(
      [
        row.id,
        `"${row.company.name.replace(/"/g, '""')}"`,
        row.subscription?.id ?? "",
        row.planName ?? "",
        row.amountMinor,
        row.currency,
        row.status,
        row.provider,
        row.merchantOidMasked,
        row.createdAt,
        row.paidAt ?? "",
        row.refundedMinor,
        `"${row.issues.map((i) => i.code).join(";")}"`,
      ].join(",")
    );
  }
  return lines.join("\n");
}
