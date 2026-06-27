import "server-only";
import { db } from "@/lib/prisma";
import type { AdminSubListQuery } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import {
  buildSubscriptionListWhere,
  buildSubscriptionOrderBy,
} from "@/lib/admin/subscriptions/admin-subscription-filter-utils";
import {
  detectSubscriptionIssues,
} from "@/lib/admin/subscriptions/admin-subscription-issue-service";

const subListInclude = {
  company: {
    include: {
      users: {
        where: { isOwner: true },
        take: 1,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  },
  plan: { select: { id: true, name: true, code: true, monthlyPrice: true } },
  lockedPlanPrice: {
    select: { currency: true, monthlyEquivalentMinor: true, salePriceMinor: true, billingInterval: true },
  },
} as const;

export async function getAdminSubscriptionList(query: AdminSubListQuery) {
  const where = buildSubscriptionListWhere(query);
  const orderBy = buildSubscriptionOrderBy(query);
  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    db.companySubscription.count({ where }),
    db.companySubscription.findMany({
      where,
      orderBy,
      skip,
      take: query.pageSize,
      include: subListInclude,
    }),
  ]);

  // Fetch last payment for each subscription in batch
  const subIds = items.map((s) => s.id);
  const lastPayments = subIds.length > 0
    ? await db.membershipPayment.findMany({
        where: {
          subscriptionId: { in: subIds },
        },
        orderBy: { createdAt: "desc" },
        distinct: ["subscriptionId"],
        select: {
          subscriptionId: true,
          status: true,
          amount: true,
          currency: true,
          paidAt: true,
          failedAt: true,
          providerEnum: true,
          createdAt: true,
        },
      })
    : [];

  const lastPaymentMap = new Map(
    lastPayments.map((p) => [p.subscriptionId, p])
  );

  const rows = items.map((sub) => {
    const lastPayment = lastPaymentMap.get(sub.id) ?? null;
    const isFree = sub.plan ? Number(sub.plan.monthlyPrice) === 0 : false;

    const issues = detectSubscriptionIssues({
      status: sub.status,
      planId: sub.planId,
      lockedPriceMinor: sub.lockedPriceMinor,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt,
      companyStatus: sub.company.status,
      lastPaymentStatus: lastPayment?.status ?? null,
      paymentCount: 1, // approximate — full count would be N+1
      failedPaymentCount: sub.failedPaymentCount,
      isFree,
    });

    const monthlyRevenue = sub.lockedPlanPrice?.monthlyEquivalentMinor ?? null;
    const currency = sub.lockedPlanPrice?.currency ?? "TRY";
    const owner = sub.company.users[0]?.user ?? null;

    return {
      id: sub.id,
      companyId: sub.company.id,
      companyName: sub.company.name,
      companyStatus: sub.company.status,
      planId: sub.planId,
      planName: sub.plan?.name ?? null,
      planCode: sub.plan?.code ?? null,
      isFree,
      status: sub.status,
      billingInterval: sub.billingInterval,
      currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt?.toISOString() ?? null,
      createdAt: sub.createdAt.toISOString(),
      owner,
      lastPayment: lastPayment
        ? {
            status: lastPayment.status,
            amount: Number(lastPayment.amount),
            currency: lastPayment.currency,
            paidAt: lastPayment.paidAt?.toISOString() ?? null,
            provider: lastPayment.providerEnum ?? null,
          }
        : null,
      monthlyRevenue,
      currency,
      issues,
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

export async function exportAdminSubscriptionsCsv(query: AdminSubListQuery): Promise<string> {
  const fullQuery = { ...query, page: 1, pageSize: 1000 };
  const list = await getAdminSubscriptionList(fullQuery);

  const headers = [
    "ID", "Firma", "Firma Durum", "Plan", "Durum", "Dönem", "Dönem Başlangıç",
    "Dönem Sonu", "Trial Bitiş", "Son Ödeme Durum", "Son Ödeme Tutar", "Para Birimi",
    "Aylık Gelir", "Oluşturulma"
  ];

  const rows = list.items.map((s) => [
    s.id,
    s.companyName,
    s.companyStatus,
    s.planName ?? "",
    s.status,
    s.billingInterval ?? "",
    s.currentPeriodStart ?? "",
    s.currentPeriodEnd ?? "",
    s.trialEndsAt ?? "",
    s.lastPayment?.status ?? "",
    s.lastPayment?.amount?.toString() ?? "",
    s.currency,
    s.monthlyRevenue != null ? (s.monthlyRevenue / 100).toFixed(2) : "",
    s.createdAt,
  ]);

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}
