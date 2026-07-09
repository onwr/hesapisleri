import { sumSalesTotal } from "@/lib/dashboard-metrics";
import { activeSaleStatusFilter } from "@/lib/sale-query-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { sumActiveAccountBalances } from "@/lib/finance-aggregation-utils";
import {
  getCanonicalFinancialSummary,
  FINANCIAL_METRIC_VERSION,
} from "@/lib/finance/financial-summary-service";
import {
  CASH_RESULT_LABEL,
  resolveMonthFinancialPeriod,
} from "@/lib/finance/financial-period";
import { getPlatformAiConfig } from "@/lib/ai/ai-config";
import { serializeForAi } from "@/lib/ai/ai-redaction";
import type { AiRuntimeContext } from "@/lib/ai/ai-context-builder";
import { db } from "@/lib/prisma";
import { z } from "zod";

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const idSchema = z.object({
  customerId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function parseDate(value?: string, fallback?: Date) {
  if (!value) return fallback || new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback || new Date() : parsed;
}

function defaultMonthRange(now = new Date()) {
  const month = resolveMonthFinancialPeriod({ referenceDate: now });
  return { from: month.from, to: month.toInclusive };
}

function clampDateRange(from: Date, to: Date) {
  const config = getPlatformAiConfig();
  const maxMs = config.maxDateRangeDays * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    return {
      from: new Date(to.getTime() - maxMs),
      to,
    };
  }
  return { from, to };
}

function limitOf(input?: number) {
  return Math.min(input || 10, getPlatformAiConfig().maxResultLimit);
}

export async function getDashboardSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );

  const saleWhere = {
    companyId: ctx.companyId,
    ...activeSaleStatusFilter(),
    createdAt: { gte: range.from, lte: range.to },
  };

  const [sales, financeSummary, accounts, unpaidInvoices, lowStockCount] =
    await Promise.all([
      db.sale.findMany({ where: saleWhere, select: { total: true, createdAt: true } }),
      getCanonicalFinancialSummary(ctx.companyId, range.from, range.to),
      db.account.findMany({
        where: { companyId: ctx.companyId, status: "ACTIVE" },
        select: { balance: true },
      }),
      db.invoice.findMany({
        where: {
          companyId: ctx.companyId,
          status: { not: "CANCELLED" },
          paymentStatus: { not: "PAID" },
        },
        select: { total: true, paidAmount: true, dueDate: true },
      }),
      db.product.count({
        where: {
          companyId: ctx.companyId,
          status: "ACTIVE",
          stock: { lte: 10 },
        },
      }),
    ]);

  const totalSales = sumSalesTotal(sales);
  const accrualProfit =
    Math.round((totalSales - financeSummary.expenses.accruedTotal) * 100) / 100;
  const pendingCollection = unpaidInvoices.reduce(
    (sum, invoice) =>
      sum + getInvoiceRemainingAmount(Number(invoice.total), Number(invoice.paidAmount)),
    0
  );
  const overdueCount = unpaidInvoices.filter(
    (invoice) => invoice.dueDate != null && invoice.dueDate < now
  ).length;

  return serializeForAi({
    module: "dashboard",
    metricVersion: FINANCIAL_METRIC_VERSION,
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    totalSales,
    salesBasis: "createdAt",
    salesBasisLabel: "Kayıt Oluşturma Tarihine Göre Satış",
    /** Accrual sales KPI — same basis as Sales page / Dashboard sales card (createdAt) */
    cashIncome: financeSummary.revenue.total,
    totalExpenses: financeSummary.expenses.cashTotal,
    /** Same as Dashboard/Reports Operasyonel Nakit Sonucu: cashIncome − cashExpense */
    profit: financeSummary.profit.operational,
    profitLabel: CASH_RESULT_LABEL,
    accrualProfit,
    cashNet: financeSummary.profit.cashNet,
    financeMirrorOutTotal: financeSummary.adjustments.financeMirrorOutTotal,
    accountBalance: sumActiveAccountBalances(accounts),
    pendingCollection,
    overdueInvoiceCount: overdueCount,
    lowStockCount,
    salesCount: sales.length,
  });
}

export async function getSalesSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );

  const sales = await db.sale.findMany({
    where: {
      companyId: ctx.companyId,
      ...activeSaleStatusFilter(),
      createdAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      saleNo: true,
      total: true,
      paidAmount: true,
      paymentStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limitOf(args.limit),
  });

  const total = sumSalesTotal(sales);
  return serializeForAi({
    module: "sales",
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    total,
    count: sales.length,
    items: sales.map((sale) => ({
      saleNo: sale.saleNo,
      total: Number(sale.total),
      paidAmount: Number(sale.paidAmount),
      paymentStatus: sale.paymentStatus,
      date: sale.createdAt.toISOString(),
    })),
  });
}

export async function getTopProducts(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );

  const items = await db.saleItem.findMany({
    where: {
      sale: {
        companyId: ctx.companyId,
        ...activeSaleStatusFilter(),
        createdAt: { gte: range.from, lte: range.to },
      },
    },
    select: {
      name: true,
      quantity: true,
      total: true,
      productId: true,
    },
  });

  const grouped = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();
  for (const item of items) {
    const key = item.productId || item.name;
    const current = grouped.get(key) || {
      name: item.name,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += Number(item.quantity);
    current.revenue += Number(item.total);
    grouped.set(key, current);
  }

  const top = [...grouped.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limitOf(args.limit));

  return serializeForAi({ module: "products", topProducts: top });
}

export async function getLowStockProducts(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const products = await db.product.findMany({
    where: {
      companyId: ctx.companyId,
      status: "ACTIVE",
      stock: { lte: 10 },
    },
    select: { id: true, name: true, sku: true, stock: true, sellPrice: true },
    orderBy: { stock: "asc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "stocks",
    lowStockProducts: products.map((product) => ({
      name: product.name,
      sku: product.sku,
      stock: Number(product.stock),
      sellPrice: Number(product.sellPrice),
    })),
  });
}

export async function getDeadStockProducts(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const products = await db.product.findMany({
    where: { companyId: ctx.companyId, status: "ACTIVE", stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      stock: true,
      saleItems: {
        where: { sale: { createdAt: { gte: since }, ...activeSaleStatusFilter() } },
        select: { id: true },
        take: 1,
      },
    },
    take: 200,
  });

  const dead = products
    .filter((product) => product.saleItems.length === 0)
    .slice(0, limitOf(args.limit))
    .map((product) => ({
      name: product.name,
      stock: Number(product.stock),
    }));

  return serializeForAi({ module: "stocks", deadStockProducts: dead });
}

export async function getCashFlowSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );

  const summary = await getCanonicalFinancialSummary(
    ctx.companyId,
    range.from,
    range.to
  );

  return serializeForAi({
    module: "cash-bank",
    metricVersion: FINANCIAL_METRIC_VERSION,
    period: { from: range.from.toISOString(), to: range.to.toISOString() },
    income: summary.revenue.total,
    expense: summary.expenses.cashTotal,
    net: summary.profit.operational,
    cashNet: summary.profit.cashNet,
    financeMirrorOutTotal: summary.adjustments.financeMirrorOutTotal,
    transferInTotal: summary.adjustments.transferInTotal,
    transferOutTotal: summary.adjustments.transferOutTotal,
    basisNote:
      "Transfer hareketleri gelir/gidere dahil değildir. Ters kayıtlar financeMirrorOutTotal alanında ayrıdır.",
  });
}

export async function getAccountBalances(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const accounts = await db.account.findMany({
    where: { companyId: ctx.companyId, status: "ACTIVE" },
    select: { id: true, name: true, type: true, balance: true, currency: true },
    orderBy: { name: "asc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "cash-bank",
    totalBalance: sumActiveAccountBalances(accounts),
    accounts: accounts.map((account) => ({
      name: account.name,
      type: account.type,
      balance: Number(account.balance),
      currency: account.currency,
    })),
  });
}

export async function getExpenseSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );
  const expenses = await db.expense.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: "CANCELLED" },
      date: { gte: range.from, lte: range.to },
    },
    select: {
      amount: true,
      category: true,
      paymentStatus: true,
      status: true,
    },
  });
  const byCategory = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category || "Diğer";
    byCategory.set(key, (byCategory.get(key) || 0) + Number(expense.amount));
  }

  const summary = await getCanonicalFinancialSummary(
    ctx.companyId,
    range.from,
    range.to
  );

  return serializeForAi({
    module: "expenses",
    metricVersion: FINANCIAL_METRIC_VERSION,
    /** Accrual list total (matches Expenses page “aktif giderler”) */
    accruedTotal: summary.expenses.accruedTotal,
    /** Cash P&L expense (matches Dashboard/Reports) */
    cashTotal: summary.expenses.cashTotal,
    unpaidAccrued: summary.expenses.unpaidAccrued,
    total: summary.expenses.accruedTotal,
    count: expenses.length,
    topCategories: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitOf(args.limit))
      .map(([category, amount]) => ({ category, amount })),
  });
}

export async function getOverdueInvoices(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const invoices = await db.invoice.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
      dueDate: { lt: now },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "invoices",
    count: invoices.length,
    items: invoices.map((invoice) => ({
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customer?.name || "—",
      remaining: getInvoiceRemainingAmount(
        Number(invoice.total),
        Number(invoice.paidAmount)
      ),
      dueDate: invoice.dueDate?.toISOString() ?? null,
    })),
  });
}

export async function getUpcomingCollections(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);

  const invoices = await db.invoice.findMany({
    where: {
      companyId: ctx.companyId,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
      dueDate: { gte: now, lte: horizon },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "invoices",
    count: invoices.length,
    items: invoices.map((invoice) => ({
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customer?.name || "—",
      remaining: getInvoiceRemainingAmount(
        Number(invoice.total),
        Number(invoice.paidAmount)
      ),
      dueDate: invoice.dueDate?.toISOString() ?? null,
    })),
  });
}

export async function getCustomerBalance(
  args: z.infer<typeof idSchema>,
  ctx: AiRuntimeContext
) {
  if (!args.customerId) {
    const customers = await db.customer.findMany({
      where: { companyId: ctx.companyId, status: "ACTIVE" },
      select: { id: true, name: true, balance: true },
      orderBy: { balance: "desc" },
      take: limitOf(args.limit),
    });
    return serializeForAi({ module: "customers", customers });
  }

  const customer = await db.customer.findFirst({
    where: { id: args.customerId, companyId: ctx.companyId },
    select: { id: true, name: true, balance: true, phone: true },
  });

  return serializeForAi({
    module: "customers",
    customer: customer
      ? {
          name: customer.name,
          balance: Number(customer.balance),
          phone: customer.phone,
        }
      : null,
  });
}

export async function getCustomerSalesSummary(
  args: z.infer<typeof idSchema>,
  ctx: AiRuntimeContext
) {
  const sales = await db.sale.findMany({
    where: {
      companyId: ctx.companyId,
      ...(args.customerId ? { customerId: args.customerId } : {}),
      ...activeSaleStatusFilter(),
    },
    select: {
      saleNo: true,
      total: true,
      paidAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "customers",
    count: sales.length,
    total: sumSalesTotal(sales),
    items: sales.map((sale) => ({
      saleNo: sale.saleNo,
      customerName: sale.customer?.name || "—",
      total: Number(sale.total),
      paidAmount: Number(sale.paidAmount),
      date: sale.createdAt.toISOString(),
    })),
  });
}

export async function getSupplierSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const suppliers = await db.supplier.findMany({
    where: { companyId: ctx.companyId, isActive: true },
    select: { id: true, name: true, currentBalance: true },
    orderBy: { currentBalance: "desc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "suppliers",
    count: suppliers.length,
    suppliers: suppliers.map((supplier) => ({
      name: supplier.name,
      balance: Number(supplier.currentBalance),
    })),
  });
}

export async function getEmployeePaymentSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, defaultMonthRange(now).from),
    parseDate(args.to, defaultMonthRange(now).to)
  );

  const payments = await db.employeePayment.findMany({
    where: {
      companyId: ctx.companyId,
      paidAt: { gte: range.from, lte: range.to, not: null },
    },
    select: {
      amount: true,
      status: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    take: limitOf(args.limit),
  });

  const total = payments.reduce((sum, row) => sum + Number(row.amount), 0);
  return serializeForAi({
    module: "employees",
    total,
    count: payments.length,
    items: payments.map((payment) => ({
      employeeName: `${payment.employee.firstName} ${payment.employee.lastName}`,
      amount: Number(payment.amount),
      status: payment.status,
    })),
  });
}

export async function getMarketplaceSummary(
  _args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const integrations = await db.marketplaceIntegration.findMany({
    where: { companyId: ctx.companyId },
    select: {
      channel: true,
      status: true,
      lastSyncAt: true,
    },
    take: limitOf(),
  });

  return serializeForAi({
    module: "settings",
    integrations: integrations.map((item) => ({
      platform: item.channel,
      status: item.status,
      lastSyncAt: item.lastSyncAt?.toISOString() || null,
    })),
  });
}

export async function getCalendarSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const now = new Date();
  const range = clampDateRange(
    parseDate(args.from, now),
    parseDate(args.to, new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
  );

  const events = await db.calendarEvent.findMany({
    where: {
      companyId: ctx.companyId,
      startAt: { gte: range.from, lte: range.to },
    },
    select: { title: true, startAt: true, type: true },
    orderBy: { startAt: "asc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "calendar",
    count: events.length,
    events: events.map((event) => ({
      type: event.type,
      title: event.title,
      startAt: event.startAt.toISOString(),
    })),
  });
}

export async function getNotificationSummary(
  args: z.infer<typeof dateRangeSchema>,
  ctx: AiRuntimeContext
) {
  const notifications = await db.notification.findMany({
    where: { companyId: ctx.companyId, userId: ctx.userId },
    select: { title: true, type: true, readAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: limitOf(args.limit),
  });

  return serializeForAi({
    module: "notifications",
    unreadCount: notifications.filter((item) => !item.readAt).length,
    items: notifications.map((item) => ({
      title: item.title,
      type: item.type,
      read: Boolean(item.readAt),
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

export const AI_READ_TOOL_SCHEMAS = {
  getDashboardSummary: dateRangeSchema,
  getSalesSummary: dateRangeSchema,
  getTopProducts: dateRangeSchema,
  getLowStockProducts: dateRangeSchema,
  getDeadStockProducts: dateRangeSchema,
  getCashFlowSummary: dateRangeSchema,
  getAccountBalances: dateRangeSchema,
  getExpenseSummary: dateRangeSchema,
  getOverdueInvoices: dateRangeSchema,
  getUpcomingCollections: dateRangeSchema,
  getCustomerBalance: idSchema,
  getCustomerSalesSummary: idSchema,
  getSupplierSummary: dateRangeSchema,
  getEmployeePaymentSummary: dateRangeSchema,
  getMarketplaceSummary: dateRangeSchema,
  getCalendarSummary: dateRangeSchema,
  getNotificationSummary: dateRangeSchema,
} as const;

export type AiReadToolName = keyof typeof AI_READ_TOOL_SCHEMAS;

export const AI_READ_TOOL_HANDLERS: Record<
  AiReadToolName,
  (args: unknown, ctx: AiRuntimeContext) => Promise<unknown>
> = {
  getDashboardSummary: (args, ctx) =>
    getDashboardSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getSalesSummary: (args, ctx) =>
    getSalesSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getTopProducts: (args, ctx) =>
    getTopProducts(args as z.infer<typeof dateRangeSchema>, ctx),
  getLowStockProducts: (args, ctx) =>
    getLowStockProducts(args as z.infer<typeof dateRangeSchema>, ctx),
  getDeadStockProducts: (args, ctx) =>
    getDeadStockProducts(args as z.infer<typeof dateRangeSchema>, ctx),
  getCashFlowSummary: (args, ctx) =>
    getCashFlowSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getAccountBalances: (args, ctx) =>
    getAccountBalances(args as z.infer<typeof dateRangeSchema>, ctx),
  getExpenseSummary: (args, ctx) =>
    getExpenseSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getOverdueInvoices: (args, ctx) =>
    getOverdueInvoices(args as z.infer<typeof dateRangeSchema>, ctx),
  getUpcomingCollections: (args, ctx) =>
    getUpcomingCollections(args as z.infer<typeof dateRangeSchema>, ctx),
  getCustomerBalance: (args, ctx) =>
    getCustomerBalance(args as z.infer<typeof idSchema>, ctx),
  getCustomerSalesSummary: (args, ctx) =>
    getCustomerSalesSummary(args as z.infer<typeof idSchema>, ctx),
  getSupplierSummary: (args, ctx) =>
    getSupplierSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getEmployeePaymentSummary: (args, ctx) =>
    getEmployeePaymentSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getMarketplaceSummary: (args, ctx) =>
    getMarketplaceSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getCalendarSummary: (args, ctx) =>
    getCalendarSummary(args as z.infer<typeof dateRangeSchema>, ctx),
  getNotificationSummary: (args, ctx) =>
    getNotificationSummary(args as z.infer<typeof dateRangeSchema>, ctx),
};
