import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  adminCompanyPatchSchema,
  adminUserPatchSchema,
  parseOptionalDate,
} from "@/lib/admin-utils";
import { startOfMonth, endOfMonth } from "@/lib/dashboard-metrics";
import { getCachedAdminOverview } from "@/lib/admin/admin-overview-cache";
import type { AdminOverviewQuery } from "@/lib/admin/admin-overview-period-utils";

export class AdminServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminServiceError";
    this.status = status;
  }
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

async function logAdminAction(input: {
  userId: string;
  companyId?: string | null;
  action: string;
  message: string;
}) {
  await db.activityLog.create({
    data: {
      userId: input.userId,
      companyId: input.companyId ?? null,
      action: input.action,
      module: "admin",
      message: input.message,
    },
  });
}

async function ensureCompanySettings(companyId: string) {
  const existing = await db.companySettings.findUnique({
    where: { companyId },
  });

  if (existing) return existing;

  return db.companySettings.create({
    data: { companyId },
  });
}

export async function getAdminOverview(query: AdminOverviewQuery = {}) {
  return getCachedAdminOverview(query);
}

export async function getAdminCompaniesSummary() {
  const now = new Date();
  const monthStart = startOfMonth(now);

  const [total, active, trial, pastDue, suspended, newThisMonth] =
    await Promise.all([
      db.company.count(),
      db.company.count({ where: { status: "ACTIVE" } }),
      db.companySubscription.count({ where: { status: "TRIAL" } }),
      db.companySubscription.count({ where: { status: "PAST_DUE" } }),
      db.company.count({ where: { status: "SUSPENDED" } }),
      db.company.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

  return { total, active, trial, pastDue, suspended, newThisMonth };
}

export async function getAdminUsersSummary() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [total, active, passive, superAdmins, recentLogins, withoutCompany] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "ACTIVE" } }),
      db.user.count({ where: { status: "PASSIVE" } }),
      db.user.count({ where: { role: "SUPER_ADMIN" } }),
      db.activityLog.groupBy({
        by: ["userId"],
        where: {
          action: "LOGIN",
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      db.user.count({ where: { companyUsers: { none: {} } } }),
    ]);

  return {
    total,
    active,
    passive,
    superAdmins,
    recentLogins: recentLogins.length,
    withoutCompany,
  };
}
export async function getAdminLogs(input?: {
  q?: string;
  module?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input?.pageSize ?? 30));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ActivityLogWhereInput = {};

  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
    ];
  }

  if (input?.module && input.module !== "ALL") {
    where.module = input.module;
  }

  if (input?.action && input.action !== "ALL") {
    where.action = input.action;
  }

  const [total, logs] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: true,
        company: true,
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: logs.map((log) => ({
      id: log.id,
      module: log.module,
      action: log.action,
      message: log.message ?? "",
      userName: log.user?.name ?? "Sistem",
      companyName: log.company?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function getAdminPaymentsSummary() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [paidTotal, monthPaid, pending, failed, refunded] = await Promise.all([
    db.membershipPayment.aggregate({
      where: { status: "PAID", provider: { not: "TRIAL" } },
      _sum: { amount: true },
    }),
    db.membershipPayment.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: monthStart, lte: monthEnd },
        provider: { not: "TRIAL" },
      },
      _sum: { amount: true },
    }),
    db.membershipPayment.count({ where: { status: "PENDING" } }),
    db.membershipPayment.count({ where: { status: "FAILED" } }),
    db.membershipPayment.count({ where: { status: "REFUNDED" } }),
  ]);

  return {
    paidTotal: decimalToNumber(paidTotal._sum.amount),
    monthPaid: decimalToNumber(monthPaid._sum.amount),
    pending,
    failed,
    refunded,
  };
}

export async function getAdminCompanies(input?: {
  q?: string;
  status?: string;
  membershipStatus?: string;
}) {
  const where: Prisma.CompanyWhereInput = {};

  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  if (input?.status && input.status !== "ALL") {
    where.status = input.status as Prisma.EnumStatusFilter["equals"];
  }

  if (input?.membershipStatus && input.membershipStatus !== "ALL") {
    where.settings = {
      membershipStatus:
        input.membershipStatus as Prisma.EnumMembershipStatusFilter["equals"],
    };
  }

  const companies = await db.company.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        where: { isOwner: true },
        include: { user: true },
        take: 1,
      },
      settings: true,
      subscription: { include: { plan: true } },
      membershipPayments: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { users: true, sales: true },
      },
    },
  });

  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    status: company.status,
    phone: company.phone,
    email: company.email,
    ownerName: company.users[0]?.user.name ?? "—",
    ownerEmail: company.users[0]?.user.email ?? null,
    membershipStatus:
      company.subscription?.status ??
      company.settings?.membershipStatus ??
      "ACTIVE",
    planName: company.subscription?.plan?.name ?? null,
    billingInterval: company.subscription?.billingInterval ?? null,
    lastPaymentDate:
      company.settings?.lastPaymentDate?.toISOString() ??
      company.membershipPayments[0]?.paidAt?.toISOString() ??
      null,
    nextPaymentDate:
      company.settings?.nextPaymentDate?.toISOString() ??
      company.membershipPayments[0]?.periodEnd?.toISOString() ??
      null,
    monthlyFee: decimalToNumber(company.settings?.monthlyFee ?? 1499),
    userCount: company._count.users,
    salesCount: company._count.sales,
    createdAt: company.createdAt.toISOString(),
  }));
}

export async function getAdminCompanyDetail(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      settings: true,
      users: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      membershipPayments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      sales: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: true },
      },
      expenses: {
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      accounts: {
        where: { status: "ACTIVE" },
      },
      customers: {
        select: { balance: true },
      },
    },
  });

  if (!company) return null;

  const settings = company.settings ?? (await ensureCompanySettings(companyId));

  const totalAccountBalance = company.accounts.reduce(
    (sum, account) => sum + decimalToNumber(account.balance),
    0
  );

  const receivable = company.customers
    .filter((c) => decimalToNumber(c.balance) > 0)
    .reduce((sum, c) => sum + decimalToNumber(c.balance), 0);

  const payable = company.customers
    .filter((c) => decimalToNumber(c.balance) < 0)
    .reduce((sum, c) => sum + Math.abs(decimalToNumber(c.balance)), 0);

  return {
    id: company.id,
    name: company.name,
    status: company.status,
    taxNo: company.taxNo,
    taxOffice: company.taxOffice,
    phone: company.phone,
    email: company.email,
    address: company.address,
    logoUrl: company.logoUrl,
    createdAt: company.createdAt.toISOString(),
    settings: {
      currency: settings.currency,
      defaultVatRate: settings.defaultVatRate,
      defaultInvoiceType: settings.defaultInvoiceType,
      membershipStatus: settings.membershipStatus,
      lastPaymentDate: settings.lastPaymentDate?.toISOString() ?? null,
      nextPaymentDate: settings.nextPaymentDate?.toISOString() ?? null,
      monthlyFee: decimalToNumber(settings.monthlyFee),
      membershipNote: settings.membershipNote,
    },
    users: company.users.map((item) => ({
      id: item.id,
      userId: item.userId,
      name: item.user.name,
      email: item.user.email,
      role: item.role,
      status: item.status,
      isOwner: item.isOwner,
      createdAt: item.createdAt.toISOString(),
    })),
    membershipPayments: company.membershipPayments.map((payment) => ({
      id: payment.id,
      amount: decimalToNumber(payment.amount),
      status: payment.status,
      periodStart: payment.periodStart.toISOString(),
      periodEnd: payment.periodEnd.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
    recentSales: company.sales.map((sale) => ({
      id: sale.id,
      saleNo: sale.saleNo,
      customerName: sale.customer?.name ?? "Perakende",
      total: decimalToNumber(sale.total),
      status: sale.status,
      createdAt: sale.createdAt.toISOString(),
    })),
    recentInvoices: company.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customer?.name ?? "—",
      total: decimalToNumber(invoice.total),
      status: invoice.status,
      createdAt: invoice.createdAt.toISOString(),
    })),
    recentExpenses: company.expenses.map((expense) => ({
      id: expense.id,
      title: expense.title,
      amount: decimalToNumber(expense.amount),
      status: expense.status,
      createdAt: expense.createdAt.toISOString(),
    })),
    finance: {
      totalAccountBalance,
      receivable,
      payable,
      accountsCount: company.accounts.length,
    },
  };
}

export async function updateAdminCompany(
  companyId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminCompanyPatchSchema.safeParse(body);

  if (!parsed.success) {
    throw new AdminServiceError("Geçersiz firma güncelleme verisi.", 400);
  }

  const company = await db.company.findUnique({ where: { id: companyId } });

  if (!company) {
    throw new AdminServiceError("Firma bulunamadı.", 404);
  }

  const data = parsed.data;
  const companyUpdate: Prisma.CompanyUpdateInput = {};
  const settingsUpdate: Prisma.CompanySettingsUpdateInput = {};

  if (data.name !== undefined) companyUpdate.name = data.name;
  if (data.phone !== undefined) companyUpdate.phone = data.phone;
  if (data.email !== undefined) companyUpdate.email = data.email;
  if (data.taxNo !== undefined) companyUpdate.taxNo = data.taxNo;
  if (data.taxOffice !== undefined) companyUpdate.taxOffice = data.taxOffice;
  if (data.address !== undefined) companyUpdate.address = data.address;
  if (data.status !== undefined) companyUpdate.status = data.status;

  if (data.membershipStatus !== undefined) {
    settingsUpdate.membershipStatus = data.membershipStatus;
  }
  if (data.lastPaymentDate !== undefined) {
    settingsUpdate.lastPaymentDate = parseOptionalDate(data.lastPaymentDate);
  }
  if (data.nextPaymentDate !== undefined) {
    settingsUpdate.nextPaymentDate = parseOptionalDate(data.nextPaymentDate);
  }
  if (data.monthlyFee !== undefined) {
    settingsUpdate.monthlyFee = data.monthlyFee;
  }
  if (data.membershipNote !== undefined) {
    settingsUpdate.membershipNote = data.membershipNote;
  }

  await db.$transaction(async (tx) => {
    if (Object.keys(companyUpdate).length > 0) {
      await tx.company.update({
        where: { id: companyId },
        data: companyUpdate,
      });
    }

    if (Object.keys(settingsUpdate).length > 0) {
      await tx.companySettings.upsert({
        where: { companyId },
        create: {
          companyId,
          membershipStatus: data.membershipStatus ?? "ACTIVE",
          lastPaymentDate:
            data.lastPaymentDate !== undefined
              ? parseOptionalDate(data.lastPaymentDate)
              : undefined,
          nextPaymentDate:
            data.nextPaymentDate !== undefined
              ? parseOptionalDate(data.nextPaymentDate)
              : undefined,
          monthlyFee: data.monthlyFee ?? 1499,
          membershipNote: data.membershipNote ?? undefined,
        },
        update: settingsUpdate,
      });
    }
  });

  if (data.status && data.status !== company.status) {
    await logAdminAction({
      userId: actorUserId,
      companyId,
      action: "UPDATE",
      message: `${company.name} firması ${data.status} durumuna alındı.`,
    });
  }

  if (
    data.membershipStatus !== undefined ||
    data.lastPaymentDate !== undefined ||
    data.nextPaymentDate !== undefined ||
    data.monthlyFee !== undefined
  ) {
    await logAdminAction({
      userId: actorUserId,
      companyId,
      action: "UPDATE",
      message: `${company.name} firmasının üyelik bilgileri güncellendi.`,
    });
  }

  return getAdminCompanyDetail(companyId);
}

export async function getAdminUsers(input?: {
  q?: string;
  status?: string;
  role?: string;
}) {
  const where: Prisma.UserWhereInput = {};

  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (input?.status && input.status !== "ALL") {
    where.status = input.status as Prisma.EnumStatusFilter["equals"];
  }

  if (input?.role === "SUPER_ADMIN") {
    where.role = "SUPER_ADMIN";
  } else if (input?.role === "USER") {
    where.role = { not: "SUPER_ADMIN" };
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      companyUsers: {
        include: { company: true },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        where: { action: "LOGIN" },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    platformRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
    status: user.status,
    companies: user.companyUsers.map((item) => ({
      id: item.company.id,
      name: item.company.name,
      role: item.role,
      isOwner: item.isOwner,
    })),
    lastLoginAt: user.activityLogs[0]?.createdAt.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function getAdminUserDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      companyUsers: {
        include: { company: true },
      },
      activityLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    platformRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
    status: user.status,
    companies: user.companyUsers.map((item) => ({
      id: item.company.id,
      name: item.company.name,
      role: item.role,
      status: item.status,
      isOwner: item.isOwner,
    })),
    activityLogs: user.activityLogs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
    })),
    createdAt: user.createdAt.toISOString(),
  };
}

// updateAdminUser kasıtlı olarak hiçbir alan kabul etmez.
// Kullanıcı durumu yalnızca /suspend ve /reactivate endpointlerinden değiştirilebilir.
// Platform rol değişikliği ayrı bir güvenlik fazında ele alınacak.
export async function updateAdminUser(
  _targetUserId: string,
  _actorUserId: string,
  body: unknown
) {
  const parsed = adminUserPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AdminServiceError(
      "Bu endpoint üzerinden kullanıcı güncellemesi yapılamaz. Durum değişikliği için /suspend veya /reactivate kullanın.",
      405
    );
  }
  // Şema strict() olduğu için boş gövde geçerse bile değiştirecek alan yoktur.
  throw new AdminServiceError(
    "Bu endpoint üzerinden kullanıcı güncellemesi yapılamaz.",
    405
  );
}
