import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/prisma";
import { getCompanyUsageSummary } from "@/lib/billing/usage/usage-query-service";
import { decimalToNumber } from "@/lib/admin/admin-overview-prisma-utils";
import { subscriptionToMonthlyMinor } from "@/lib/admin/admin-overview-metric-utils";
import { summarizeMembershipPaymentError } from "@/lib/admin/admin-overview-payment-labels";
import { getAdminSubscriptionDetail } from "@/lib/admin-subscription-service";
import {
  detectCompanyIssues,
  batchLastActivityMap,
  batchLastLoginMap,
} from "@/lib/admin/companies/admin-company-issue-service";
import { countAdminCompanyNotes } from "@/lib/admin/companies/admin-company-note-service";
import {
  maskIp,
  maskProviderId,
  serializeLastPayment,
  shortId,
} from "@/lib/admin/companies/admin-company-serializers";
import { startOfMonth, endOfMonth } from "@/lib/dashboard-metrics";

export type AdminCompanyTab =
  | "overview"
  | "users"
  | "subscription"
  | "payments"
  | "usage"
  | "integrations"
  | "activity"
  | "notes";

async function loadCompanyHeader(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      settings: true,
      subscription: { include: { plan: true } },
      users: {
        where: { isOwner: true },
        include: { user: true },
        take: 1,
      },
    },
  });

  if (!company) return null;

  const [noteCount, lastActivityMap, lastLoginMap] = await Promise.all([
    countAdminCompanyNotes(companyId),
    batchLastActivityMap([companyId]),
    batchLastLoginMap([companyId]),
  ]);

  const owner = company.users[0]?.user ?? null;
  const lastActivityAt = lastActivityMap.get(companyId) ?? null;
  const lastLoginAt = lastLoginMap.get(companyId) ?? null;

  const issues = detectCompanyIssues({
    company: {
      id: company.id,
      status: company.status,
      archivedAt: company.archivedAt,
    },
    subscription: company.subscription
      ? {
          id: company.subscription.id,
          status: company.subscription.status,
          trialEndsAt: company.subscription.trialEndsAt,
          currentPeriodEnd: company.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: company.subscription.cancelAtPeriodEnd,
          failedPaymentCount: company.subscription.failedPaymentCount,
        }
      : null,
    owner: owner ? { status: owner.status } : null,
    activeUserCount: 0,
    lastPayment: null,
    lastLoginAt,
    lastActivityAt,
    integrationErrors: 0,
  });

  return {
    id: company.id,
    shortId: shortId(company.id),
    name: company.name,
    status: company.status,
    archivedAt: company.archivedAt?.toISOString() ?? null,
    suspendedAt: company.suspendedAt?.toISOString() ?? null,
    suspendedReason: company.suspendedReason,
    planName: company.subscription?.plan?.name ?? null,
    subscriptionStatus: company.subscription?.status ?? null,
    subscriptionId: company.subscription?.id ?? null,
    createdAt: company.createdAt.toISOString(),
    lastActivityAt: lastActivityAt?.toISOString() ?? null,
    owner: owner
      ? { id: owner.id, name: owner.name, email: owner.email }
      : null,
    noteCount,
    openIssueCount: issues.length,
    issues,
    settings: {
      currency: company.settings?.currency ?? "TRY",
      timezone: "Europe/Istanbul",
    },
  };
}

export async function getAdminCompanyHeader(companyId: string) {
  return unstable_cache(
    () => loadCompanyHeader(companyId),
    [`admin-company-detail:${companyId}`, "header"],
    { revalidate: 45, tags: [`admin-company-detail:${companyId}`] }
  )();
}

export async function getAdminCompanyOverviewTab(companyId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      settings: true,
      subscription: { include: { plan: true } },
      users: {
        where: { isOwner: true },
        include: { user: true },
        take: 1,
      },
      membershipPayments: {
        where: { provider: { not: "TRIAL" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      marketplaceIntegrations: {
        where: { lastError: { not: null } },
        select: { id: true },
      },
      efaturamIntegration: { select: { lastError: true } },
      billingOutboxEvents: {
        where: { status: { in: ["FAILED", "PENDING"] } },
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!company) return null;

  const [
    usage,
    activeUsers,
    lastActivityMap,
    lastLoginMap,
    salesMonth,
    invoicesMonth,
    collectionsMonth,
    expensesMonth,
    eDocumentsMonth,
    customers,
    suppliers,
  ] = await Promise.all([
    getCompanyUsageSummary(companyId),
    db.companyUser.count({ where: { companyId, status: "ACTIVE" } }),
    batchLastActivityMap([companyId]),
    batchLastLoginMap([companyId]),
    db.sale.count({
      where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    db.invoice.count({
      where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    db.salePayment.aggregate({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    db.invoiceDocumentSubmission.count({
      where: {
        companyId,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    db.customer.count({ where: { companyId } }),
    db.supplier.count({ where: { companyId } }),
  ]);

  const salesAmount = await db.sale.aggregate({
    where: { companyId, createdAt: { gte: monthStart, lte: monthEnd } },
    _sum: { total: true },
  });

  const owner = company.users[0]?.user ?? null;
  const lastLoginAt = lastLoginMap.get(companyId) ?? null;
  const lastActivityAt = lastActivityMap.get(companyId) ?? null;
  const lastPayment = company.membershipPayments[0] ?? null;

  const issues = detectCompanyIssues({
    company: {
      id: company.id,
      status: company.status,
      archivedAt: company.archivedAt,
    },
    subscription: company.subscription
      ? {
          id: company.subscription.id,
          status: company.subscription.status,
          trialEndsAt: company.subscription.trialEndsAt,
          currentPeriodEnd: company.subscription.currentPeriodEnd,
          cancelAtPeriodEnd: company.subscription.cancelAtPeriodEnd,
          failedPaymentCount: company.subscription.failedPaymentCount,
        }
      : null,
    owner: owner ? { status: owner.status } : null,
    activeUserCount: activeUsers,
    lastPayment: lastPayment
      ? { status: lastPayment.status, failedAt: lastPayment.failedAt }
      : null,
    lastLoginAt,
    lastActivityAt,
    integrationErrors:
      company.marketplaceIntegrations.length +
      (company.efaturamIntegration?.lastError ? 1 : 0),
  });

  if (company.billingOutboxEvents.length > 0) {
    issues.push({
      code: "billing_outbox",
      label: "Bekleyen veya başarısız faturalama işi",
      severity: "warning",
      href: `/admin/companies/${companyId}?tab=subscription`,
    });
  }

  return {
    companyInfo: {
      name: company.name,
      taxNo: company.taxNo,
      taxOffice: company.taxOffice,
      phone: company.phone,
      email: company.email,
      address: company.address,
      currency: company.settings?.currency ?? "TRY",
      timezone: "Europe/Istanbul",
    },
    platformInfo: {
      createdAt: company.createdAt.toISOString(),
      status: company.status,
      owner: owner
        ? { id: owner.id, name: owner.name, email: owner.email }
        : null,
      activeUserCount: activeUsers,
      lastLoginAt: lastLoginAt?.toISOString() ?? null,
      lastActivityAt: lastActivityAt?.toISOString() ?? null,
    },
    usage: {
      users: usage.MAX_USERS,
      products: usage.MAX_PRODUCTS,
      warehouses: usage.MAX_WAREHOUSES,
      employees: usage.MAX_EMPLOYEES,
      customers,
      suppliers,
      marketplaces: usage.MAX_MARKETPLACES,
      integrations:
        company.marketplaceIntegrations.length +
        (company.efaturamIntegration ? 1 : 0),
    },
    last30Days: {
      salesCount: salesMonth,
      salesAmount: decimalToNumber(salesAmount._sum.total),
      collectionsAmount: decimalToNumber(collectionsMonth._sum.amount),
      expensesAmount: decimalToNumber(expensesMonth._sum.amount),
      invoicesCount: invoicesMonth,
      eDocumentsCount: eDocumentsMonth,
      currency: company.settings?.currency ?? "TRY",
    },
    issues,
  };
}

export async function getAdminCompanyUsersTab(companyId: string) {
  const users = await db.companyUser.findMany({
    where: { companyId },
    include: {
      user: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });

  const loginMap = await batchLastLoginMap([companyId]);

  return users.map((entry) => ({
    id: entry.id,
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    role: entry.role,
    status: entry.status,
    isOwner: entry.isOwner,
    lastLoginAt: loginMap.get(companyId)?.toISOString() ?? entry.user.updatedAt.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    inviteStatus: entry.status === "INVITED" ? "PENDING" : null,
    mfaEnabled: false,
    href: `/admin/users/${entry.userId}`,
  }));
}

export async function getAdminCompanySubscriptionTab(companyId: string) {
  const subscription = await db.companySubscription.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!subscription) return { subscription: null };

  const detail = await getAdminSubscriptionDetail(subscription.id);
  const sub = detail.subscription;
  const mrrMinor = subscriptionToMonthlyMinor({
    billingInterval: sub.billingInterval,
    lockedPriceMinor: sub.lockedPriceMinor,
    monthlyEquivalentMinor: null,
  });

  return {
    subscription: {
      ...detail,
      mrrMinor,
      providerCustomerIdMasked: null,
      providerSubscriptionIdMasked: maskProviderId(subscription.id),
    },
  };
}

export async function getAdminCompanyPaymentsTab(
  companyId: string,
  page = 1,
  pageSize = 25
) {
  const skip = (page - 1) * pageSize;
  const where = { companyId, provider: { not: "TRIAL" } };

  const [total, payments] = await Promise.all([
    db.membershipPayment.count({ where }),
    db.membershipPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { plan: true },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: payments.map((payment) => ({
      id: payment.id,
      date: payment.createdAt.toISOString(),
      planName: payment.plan?.name ?? null,
      amount: decimalToNumber(payment.amount),
      currency: payment.currency,
      provider: payment.providerEnum ?? payment.provider,
      status: payment.status,
      providerRefMasked: maskProviderId(payment.merchantOid ?? payment.paymentRef),
      errorSummary: summarizeMembershipPaymentError(payment),
      refundStatus:
        payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED"
          ? payment.status
          : null,
      href: `/admin/payments/${payment.id}`,
    })),
  };
}

export async function getAdminCompanyUsageTab(companyId: string) {
  const usage = await getCompanyUsageSummary(companyId);
  const [customers, suppliers, sales, invoices] = await Promise.all([
    db.customer.count({ where: { companyId } }),
    db.supplier.count({ where: { companyId } }),
    db.sale.count({ where: { companyId } }),
    db.invoice.count({ where: { companyId } }),
  ]);

  const overrides = await db.companyEntitlementOverride.findMany({
    where: { companyId, status: "ACTIVE" },
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  const addOns = await db.companyAddOnSubscription.findMany({
    where: { companyId, status: "ACTIVE" },
    include: { addOn: true },
    take: 10,
  });

  return {
    counts: {
      users: usage.MAX_USERS,
      products: usage.MAX_PRODUCTS,
      warehouses: usage.MAX_WAREHOUSES,
      employees: usage.MAX_EMPLOYEES,
      marketplaces: usage.MAX_MARKETPLACES,
      customers,
      suppliers,
      sales,
      invoices,
    },
    monthly: {
      eDocuments: usage.MONTHLY_E_DOCUMENTS,
      ocr: usage.MONTHLY_OCR_SCANS,
      exports: usage.MONTHLY_EXPORTS,
      api: usage.MONTHLY_API_REQUESTS,
      automations: usage.MONTHLY_AUTOMATIONS,
      storageMb: usage.STORAGE_MB,
    },
    overrides: overrides.map((item) => ({
      id: item.id,
      code: item.entitlementCode,
      value: item.numberValue ?? item.booleanValue ?? item.stringValue,
    })),
    addOns: addOns.map((item) => ({
      id: item.id,
      name: item.addOn.name,
      status: item.status,
    })),
    historyAvailable: false,
  };
}

export async function getAdminCompanyIntegrationsTab(companyId: string) {
  const [marketplaces, eDocument, paymentMethods] = await Promise.all([
    db.marketplaceIntegration.findMany({ where: { companyId } }),
    db.efaturamIntegration.findUnique({ where: { companyId } }),
    db.companyPaymentMethod.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const items = [
    ...marketplaces.map((item) => ({
      id: item.id,
      provider: item.channel,
      status: item.status,
      environment: "production",
      lastSuccessAt: item.lastSyncAt?.toISOString() ?? null,
      lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
      lastError: item.lastError ? "Senkronizasyon hatası mevcut" : null,
      hasCredentials: Boolean(item.credentialsEncrypted),
      href: `/settings/integrations`,
    })),
    ...(eDocument
      ? [
          {
            id: eDocument.id,
            provider: eDocument.provider,
            status: eDocument.status,
            environment: eDocument.environment,
            lastSuccessAt: eDocument.lastSuccessfulAt?.toISOString() ?? null,
            lastSyncAt: eDocument.lastTestedAt?.toISOString() ?? null,
            lastError: eDocument.lastError
              ? "E-belge bağlantı hatası"
              : null,
            hasCredentials: Boolean(eDocument.credentialsEncrypted),
            href: `/settings/integrations`,
          },
        ]
      : []),
    ...paymentMethods.map((item) => ({
      id: item.id,
      provider: item.provider,
      status: item.status,
      environment: "production",
      lastSuccessAt: null,
      lastSyncAt: null,
      lastError: null,
      hasCredentials: true,
      href: `/admin/companies/${companyId}?tab=payments`,
    })),
  ];

  return { items };
}

export async function getAdminCompanyActivityTab(
  companyId: string,
  input?: {
    page?: number;
    pageSize?: number;
    module?: string;
    action?: string;
    q?: string;
  }
) {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, input?.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ActivityLogWhereInput = {
    companyId,
  };

  if (input?.module && input.module !== "ALL") {
    where.module = input.module;
  }
  if (input?.action && input.action !== "ALL") {
    where.action = input.action;
  }
  if (input?.q?.trim()) {
    where.OR = [
      { message: { contains: input.q.trim(), mode: "insensitive" } },
      { action: { contains: input.q.trim(), mode: "insensitive" } },
    ];
  }

  const [total, logs] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: true },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      actorName: log.user?.name ?? "Sistem",
      action: log.action,
      module: log.module,
      description: log.message ?? "",
      ipMasked: maskIp(log.ip),
      source:
        log.module === "admin" || log.module === "admin-companies"
          ? "admin"
          : log.module === "admin-subscriptions"
            ? "admin"
            : "tenant",
      href: null,
    })),
  };
}

export async function deactivateAdminCompanyUser(
  companyId: string,
  companyUserId: string,
  actorUserId: string,
  reason: string
) {
  const entry = await db.companyUser.findFirst({
    where: { id: companyUserId, companyId },
    include: { user: true },
  });
  if (!entry) throw new Error("Kullanıcı bulunamadı.");

  if (entry.isOwner && entry.status === "ACTIVE") {
    const activeOwners = await db.companyUser.count({
      where: { companyId, isOwner: true, status: "ACTIVE" },
    });
    if (activeOwners <= 1) {
      throw new Error("Son aktif sahip pasife alınamaz.");
    }
  }

  await db.companyUser.update({
    where: { id: companyUserId },
    data: { status: "PASSIVE" },
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId: actorUserId,
      action: "UPDATE",
      module: "admin-companies",
      message: JSON.stringify({
        action: "COMPANY_USER_DEACTIVATED",
        companyUserId,
        reason,
        targetUserId: entry.userId,
      }),
    },
  });

  return { success: true };
}

export async function reactivateAdminCompanyUser(
  companyId: string,
  companyUserId: string,
  actorUserId: string
) {
  const entry = await db.companyUser.findFirst({
    where: { id: companyUserId, companyId },
  });
  if (!entry) throw new Error("Kullanıcı bulunamadı.");

  await db.companyUser.update({
    where: { id: companyUserId },
    data: { status: "ACTIVE" },
  });

  await db.activityLog.create({
    data: {
      companyId,
      userId: actorUserId,
      action: "UPDATE",
      module: "admin-companies",
      message: JSON.stringify({
        action: "COMPANY_USER_REACTIVATED",
        companyUserId,
      }),
    },
  });

  return { success: true };
}
