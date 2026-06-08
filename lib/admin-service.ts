import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  adminCompanyPatchSchema,
  adminUserPatchSchema,
  parseOptionalDate,
  validateSuperAdminRoleChange,
  validateUserStatusChange,
} from "@/lib/admin-utils";
import { startOfDay, startOfMonth, endOfMonth } from "@/lib/dashboard-metrics";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";

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

export async function getAdminOverview() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [
    totalCompanies,
    activeCompanies,
    totalUsers,
    todaySales,
    monthSalesAgg,
    activeMemberships,
    pastDueMemberships,
    recentCompanies,
    recentLogs,
    overdueCompanies,
  ] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { status: "ACTIVE" } }),
    db.user.count(),
    db.sale.count({
      where: {
        createdAt: { gte: todayStart },
        ...activeSaleStatusFilter(),
      },
    }),
    db.sale.aggregate({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        ...activeSaleStatusFilter(),
      },
      _sum: { total: true },
    }),
    db.companySettings.count({ where: { membershipStatus: "ACTIVE" } }),
    db.companySettings.count({
      where: {
        OR: [
          { membershipStatus: "PAST_DUE" },
          {
            membershipStatus: "ACTIVE",
            nextPaymentDate: { lt: now },
          },
        ],
      },
    }),
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        users: {
          where: { isOwner: true },
          include: { user: true },
          take: 1,
        },
        settings: true,
        _count: { select: { users: true, sales: true } },
      },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: true,
        company: true,
      },
    }),
    db.company.findMany({
      where: {
        OR: [
          { settings: { membershipStatus: "PAST_DUE" } },
          {
            settings: {
              membershipStatus: "ACTIVE",
              nextPaymentDate: { lt: now },
            },
          },
        ],
      },
      take: 5,
      include: { settings: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    metrics: {
      totalCompanies,
      activeCompanies,
      totalUsers,
      todaySales,
      monthPlatformVolume: decimalToNumber(monthSalesAgg._sum.total),
      activeMemberships,
      pastDueMemberships,
    },
    recentCompanies: recentCompanies.map((company) => ({
      id: company.id,
      name: company.name,
      status: company.status,
      ownerName: company.users[0]?.user.name ?? "—",
      userCount: company._count.users,
      salesCount: company._count.sales,
      membershipStatus: company.settings?.membershipStatus ?? "ACTIVE",
      createdAt: company.createdAt.toISOString(),
    })),
    recentLogs: recentLogs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      message: log.message ?? "",
      userName: log.user?.name ?? "Sistem",
      companyName: log.company?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    overdueCompanies: overdueCompanies.map((company) => ({
      id: company.id,
      name: company.name,
      membershipStatus: company.settings?.membershipStatus ?? "ACTIVE",
      nextPaymentDate: company.settings?.nextPaymentDate?.toISOString() ?? null,
    })),
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
    membershipStatus: company.settings?.membershipStatus ?? "ACTIVE",
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

export async function updateAdminUser(
  targetUserId: string,
  actorUserId: string,
  body: unknown
) {
  const parsed = adminUserPatchSchema.safeParse(body);

  if (!parsed.success) {
    throw new AdminServiceError("Geçersiz kullanıcı güncelleme verisi.", 400);
  }

  const user = await db.user.findUnique({ where: { id: targetUserId } });

  if (!user) {
    throw new AdminServiceError("Kullanıcı bulunamadı.", 404);
  }

  const data = parsed.data;

  if (data.role !== undefined) {
    const validation = validateSuperAdminRoleChange({
      actorUserId,
      targetUserId,
      nextRole: data.role,
    });

    if (!validation.ok) {
      throw new AdminServiceError(validation.message, 400);
    }
  }

  if (data.status !== undefined) {
    const validation = validateUserStatusChange({
      actorUserId,
      targetUserId,
      nextStatus: data.status,
    });

    if (!validation.ok) {
      throw new AdminServiceError(validation.message, 400);
    }
  }

  const updated = await db.user.update({
    where: { id: targetUserId },
    data: {
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });

  if (data.role !== undefined && data.role !== user.role) {
    const action =
      data.role === "SUPER_ADMIN"
        ? "Super Admin yetkisi verildi"
        : "Super Admin yetkisi kaldırıldı";

    await logAdminAction({
      userId: actorUserId,
      action: "UPDATE",
      message: `${user.name} (${user.email}) için ${action}.`,
    });
  }

  if (data.status !== undefined && data.status !== user.status) {
    await logAdminAction({
      userId: actorUserId,
      action: "UPDATE",
      message: `${user.name} (${user.email}) kullanıcısı ${data.status} durumuna alındı.`,
    });
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
  };
}
