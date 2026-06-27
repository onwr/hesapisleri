import { db } from "@/lib/prisma";
import { getCompaniesUsageSummary } from "@/lib/billing/usage/usage-query-service";
import {
  buildAdminCompanyListWhere,
  buildAdminCompanyOrderBy,
  type AdminCompanyListFilters,
} from "@/lib/admin/companies/admin-company-filter-utils";
import {
  batchLastActivityMap,
  batchLastLoginMap,
  detectCompanyIssues,
} from "@/lib/admin/companies/admin-company-issue-service";
import {
  serializeLastPayment,
  shortId,
} from "@/lib/admin/companies/admin-company-serializers";
import { formatMembershipPeriod } from "@/lib/membership-utils";

const PAID_STATUSES = ["ACTIVE", "CANCEL_AT_PERIOD_END"] as const;

export async function listAdminCompanyPlans() {
  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return plans;
}

export async function listAdminCompaniesPaginated(filters: AdminCompanyListFilters) {
  const where = buildAdminCompanyListWhere(filters);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [total, companies] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: buildAdminCompanyOrderBy(filters.sort),
      skip,
      take: pageSize,
      include: {
        users: {
          where: { isOwner: true },
          include: { user: true },
          take: 1,
        },
        subscription: { include: { plan: true } },
        membershipPayments: {
          where: { provider: { not: "TRIAL" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        marketplaceIntegrations: {
          where: { lastError: { not: null } },
          select: { id: true },
          take: 1,
        },
        efaturamIntegration: {
          select: { id: true, lastError: true },
        },
        _count: {
          select: {
            users: { where: { status: "ACTIVE" } },
          },
        },
      },
    }),
  ]);

  const companyIds = companies.map((company) => company.id);
  const [usageMap, lastActivityMap, lastLoginMap, activeUserCounts] =
    await Promise.all([
      getCompaniesUsageSummary(companyIds),
      batchLastActivityMap(companyIds),
      batchLastLoginMap(companyIds),
      db.companyUser.groupBy({
        by: ["companyId"],
        where: { companyId: { in: companyIds }, status: "ACTIVE" },
        _count: { _all: true },
      }),
    ]);

  const activeUsersByCompany = new Map(
    activeUserCounts.map((row) => [row.companyId, row._count._all])
  );

  const items = companies.map((company) => {
    const owner = company.users[0]?.user ?? null;
    const subscription = company.subscription;
    const lastPayment = company.membershipPayments[0] ?? null;
    const usage = usageMap.get(company.id);
    const lastActivityAt = lastActivityMap.get(company.id) ?? null;
    const lastLoginAt = lastLoginMap.get(company.id) ?? null;
    const integrationErrors =
      company.marketplaceIntegrations.length +
      (company.efaturamIntegration?.lastError ? 1 : 0);

    const issues = detectCompanyIssues({
      company: {
        id: company.id,
        status: company.status,
        archivedAt: company.archivedAt,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            failedPaymentCount: subscription.failedPaymentCount,
          }
        : null,
      owner: owner ? { status: owner.status } : null,
      activeUserCount: activeUsersByCompany.get(company.id) ?? 0,
      lastPayment: lastPayment
        ? {
            status: lastPayment.status,
            failedAt: lastPayment.failedAt,
          }
        : null,
      lastLoginAt,
      lastActivityAt,
      integrationErrors,
    });

    const payment = serializeLastPayment(lastPayment);

    return {
      id: company.id,
      shortId: shortId(company.id),
      name: company.name,
      status: company.status,
      archivedAt: company.archivedAt?.toISOString() ?? null,
      owner: owner
        ? { id: owner.id, name: owner.name, email: owner.email }
        : null,
      plan: subscription?.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            interval: subscription.billingInterval,
            intervalLabel: subscription.billingInterval
              ? formatMembershipPeriod(subscription.billingInterval)
              : null,
            isPaid:
              subscription.status != null &&
              PAID_STATUSES.includes(
                subscription.status as (typeof PAID_STATUSES)[number]
              ),
            isTrial: subscription.status === "TRIAL",
          }
        : null,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            startedAt: subscription.createdAt.toISOString(),
            currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
          }
        : null,
      payment,
      usage: {
        users: usage?.MAX_USERS ?? company._count.users,
        products: usage?.MAX_PRODUCTS ?? 0,
        warehouses: usage?.MAX_WAREHOUSES ?? 0,
        employees: usage?.MAX_EMPLOYEES ?? 0,
      },
      activity: {
        lastLoginAt: lastLoginAt?.toISOString() ?? null,
        lastActivityAt: lastActivityAt?.toISOString() ?? null,
      },
      issues,
      createdAt: company.createdAt.toISOString(),
      href: `/admin/companies/${company.id}`,
    };
  });

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items,
  };
}

export async function exportAdminCompaniesCsv(filters: AdminCompanyListFilters) {
  const exportFilters = { ...filters, page: 1, pageSize: 100 };
  const rows: string[] = [];
  let page = 1;
  let totalPages = 1;

  rows.push(
    [
      "Firma ID",
      "Firma Adı",
      "Durum",
      "Sahip",
      "E-posta",
      "Plan",
      "Abonelik",
      "Son Ödeme Durumu",
      "Kullanıcı",
      "Oluşturulma",
    ].join(",")
  );

  while (page <= totalPages) {
    const result = await listAdminCompaniesPaginated({
      ...exportFilters,
      page,
    });
    totalPages = result.totalPages;

    for (const item of result.items) {
      rows.push(
        [
          item.id,
          `"${item.name.replace(/"/g, '""')}"`,
          item.status,
          item.owner ? `"${item.owner.name.replace(/"/g, '""')}"` : "",
          item.owner?.email ?? "",
          item.plan?.name ?? "",
          item.subscription?.status ?? "",
          item.payment.status ?? "",
          String(item.usage.users),
          item.createdAt.slice(0, 10),
        ].join(",")
      );
    }

    page += 1;
    if (page > 20) break;
  }

  return rows.join("\n");
}
