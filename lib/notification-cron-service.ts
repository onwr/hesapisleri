import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { createNotification } from "@/lib/notification-service";
import { resolveCollectionDueDate } from "@/lib/calendar-utils";
import {
  endOfYesterday,
  startOfYesterday,
} from "@/lib/dashboard-metrics";
import { getSaleRemainingAmount } from "@/lib/sale-payment-utils";
import {
  activeInvoiceStatusFilter,
  activeSaleStatusFilter,
} from "@/lib/sale-query-utils";
import {
  attachEmployeePaymentsOverdueSummary,
  updateOverdueEmployeePaymentsForActiveCompanies,
} from "@/lib/employee-payment-overdue-service";
import {
  buildDailySummaryNotificationInput,
  buildDueInvoiceNotificationInput,
  buildEmployeePaymentDueNotificationInput,
  buildLateCollectionNotificationInput,
  buildLowStockNotificationInput,
  buildMembershipExpiredNotificationInput,
  buildMembershipExpiringNotificationInput,
  computeDailySummaryStats,
  countLowStockProducts,
  filterEmployeePaymentsDueOnWindow,
  filterInvoicesDueOnWindow,
  filterOverdueCollections,
  formatDateKey,
  maxDaysOverdue,
  type DueInvoiceWindow,
  DUE_INVOICE_WINDOWS,
  EMPLOYEE_PAYMENT_DUE_WINDOWS,
  MEMBERSHIP_EXPIRY_WINDOWS,
  getMembershipExpiryDateForWindow,
  type ProactiveNotificationPayload,
  type ProactiveNotificationType,
} from "@/lib/notification-cron-utils";
import {
  getMembershipStatus,
  getRemainingMembershipDays,
} from "@/lib/membership-utils";
import { ensureCompanySubscription } from "@/lib/membership-service";

export type CronJobResult = {
  companyId: string;
  type: ProactiveNotificationType;
  created: number;
  skipped: number;
};

export type CronRunSummary = {
  success: true;
  created: number;
  skipped: number;
  companiesScanned: number;
  items: CronJobResult[];
  employeePayments?: {
    overdueUpdated: number;
  };
};

type CompanyCronContext = {
  companyId: string;
  defaultDueDays: number;
  notifyLowStock: boolean;
  notifyDueInvoices: boolean;
  notifyLateCollections: boolean;
  notifyDailySummary: boolean;
  notifyEmployeePayments: boolean;
};

async function hasDedupeKey(companyId: string, dedupeKey: string) {
  const existing = await db.notification.findFirst({
    where: { companyId, dedupeKey },
    select: { id: true },
  });

  return Boolean(existing);
}

async function emitProactiveNotification(
  companyId: string,
  payload: ProactiveNotificationPayload,
  enabled: boolean
): Promise<"created" | "skipped"> {
  if (!enabled) {
    return "skipped";
  }

  if (await hasDedupeKey(companyId, payload.dedupeKey)) {
    return "skipped";
  }

  const created = await createNotification({
    companyId,
    userId: null,
    type: "WARNING",
    category: payload.category,
    module: payload.module,
    entityType: payload.entityType,
    actionUrl: payload.actionUrl,
    metadata: payload.metadata as Prisma.InputJsonValue | undefined,
    priority: payload.priority,
    dedupeKey: payload.dedupeKey,
    title: payload.title,
    message: payload.message,
    isProactive: true,
  });

  return created ? "created" : "skipped";
}

function recordJobResult(
  items: CronJobResult[],
  companyId: string,
  type: ProactiveNotificationType,
  outcome: "created" | "skipped"
) {
  const existing = items.find(
    (item) => item.companyId === companyId && item.type === type
  );

  if (existing) {
    if (outcome === "created") existing.created += 1;
    else existing.skipped += 1;
    return;
  }

  items.push({
    companyId,
    type,
    created: outcome === "created" ? 1 : 0,
    skipped: outcome === "skipped" ? 1 : 0,
  });
}

async function processLowStock(
  context: CompanyCronContext,
  dateKey: string,
  items: CronJobResult[]
) {
  const products = await db.product.findMany({
    where: { companyId: context.companyId, status: "ACTIVE" },
    select: { stock: true, minStock: true, status: true },
  });

  const lowStockCount = countLowStockProducts(products);
  if (lowStockCount === 0) {
    return;
  }

  const payload = buildLowStockNotificationInput({
    companyId: context.companyId,
    count: lowStockCount,
    dateKey,
  });

  const outcome = await emitProactiveNotification(
    context.companyId,
    payload,
    context.notifyLowStock
  );
  recordJobResult(items, context.companyId, "LOW_STOCK", outcome);
}

async function processDueInvoices(
  context: CompanyCronContext,
  referenceDate: Date,
  dateKey: string,
  items: CronJobResult[]
) {
  const invoices = await db.invoice.findMany({
    where: {
      companyId: context.companyId,
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      status: { notIn: ["CANCELLED", "DRAFT"] },
    },
    select: {
      dueDate: true,
      createdAt: true,
    },
  });

  for (const window of DUE_INVOICE_WINDOWS) {
    const dueInvoices = filterInvoicesDueOnWindow(
      invoices,
      window,
      referenceDate,
      context.defaultDueDays
    );

    if (dueInvoices.length === 0) {
      continue;
    }

    const payload = buildDueInvoiceNotificationInput({
      companyId: context.companyId,
      count: dueInvoices.length,
      window,
      dateKey,
    });

    const outcome = await emitProactiveNotification(
      context.companyId,
      payload,
      context.notifyDueInvoices
    );
    recordJobResult(items, context.companyId, "DUE_INVOICE", outcome);
  }
}

async function processLateCollections(
  context: CompanyCronContext,
  referenceDate: Date,
  dateKey: string,
  items: CronJobResult[]
) {
  const [invoices, sales] = await Promise.all([
    db.invoice.findMany({
      where: {
        companyId: context.companyId,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        status: { notIn: ["CANCELLED", "DRAFT"] },
      },
      select: {
        total: true,
        paidAmount: true,
        dueDate: true,
        createdAt: true,
      },
    }),
    db.sale.findMany({
      where: {
        companyId: context.companyId,
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
        invoice: { is: null },
        ...activeSaleStatusFilter(),
      },
      select: {
        total: true,
        paidAmount: true,
        createdAt: true,
      },
    }),
  ]);

  const records = [
    ...invoices.map((invoice) => ({
      dueDate: resolveCollectionDueDate({
        issueDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        defaultDueDays: context.defaultDueDays,
      }),
      remaining: getInvoiceRemainingAmount(
        Number(invoice.total),
        Number(invoice.paidAmount)
      ),
    })),
    ...sales.map((sale) => ({
      dueDate: resolveCollectionDueDate({
        issueDate: sale.createdAt,
        defaultDueDays: context.defaultDueDays,
      }),
      remaining: getSaleRemainingAmount(
        Number(sale.total),
        Number(sale.paidAmount)
      ),
    })),
  ];

  const overdue = filterOverdueCollections(records, referenceDate);
  if (overdue.length === 0) {
    return;
  }

  const payload = buildLateCollectionNotificationInput({
    companyId: context.companyId,
    count: overdue.length,
    overdueDays: maxDaysOverdue(records, referenceDate),
    dateKey,
  });

  const outcome = await emitProactiveNotification(
    context.companyId,
    payload,
    context.notifyLateCollections
  );
  recordJobResult(items, context.companyId, "LATE_COLLECTION", outcome);
}

async function processDailySummary(
  context: CompanyCronContext,
  referenceDate: Date,
  dateKey: string,
  items: CronJobResult[]
) {
  const dayStart = startOfYesterday(referenceDate);
  const dayEnd = endOfYesterday(referenceDate);

  const [sales, expenses, invoices] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId: context.companyId,
        createdAt: { gte: dayStart, lte: dayEnd },
        ...activeSaleStatusFilter(),
      },
      select: { total: true, createdAt: true },
    }),
    db.expense.findMany({
      where: {
        companyId: context.companyId,
        date: { gte: dayStart, lte: dayEnd },
        status: { not: "CANCELLED" },
      },
      select: { date: true },
    }),
    db.invoice.findMany({
      where: {
        companyId: context.companyId,
        createdAt: { gte: dayStart, lte: dayEnd },
        ...activeInvoiceStatusFilter(),
        status: { not: "DRAFT" },
      },
      select: { createdAt: true },
    }),
  ]);

  const stats = computeDailySummaryStats({
    sales,
    expenses,
    invoices,
    dayStart,
    dayEnd,
  });

  const payload = buildDailySummaryNotificationInput({
    companyId: context.companyId,
    stats,
    dateKey,
  });

  const outcome = await emitProactiveNotification(
    context.companyId,
    payload,
    context.notifyDailySummary
  );
  recordJobResult(items, context.companyId, "DAILY_SUMMARY", outcome);
}

async function processEmployeePaymentDue(
  context: CompanyCronContext,
  referenceDate: Date,
  dateKey: string,
  items: CronJobResult[]
) {
  const payments = await db.employeePayment.findMany({
    where: {
      companyId: context.companyId,
      status: { in: ["PENDING", "OVERDUE"] },
      dueDate: { not: null },
      amount: { gt: 0 },
    },
    select: {
      dueDate: true,
      status: true,
    },
  });

  for (const window of EMPLOYEE_PAYMENT_DUE_WINDOWS) {
    const duePayments = filterEmployeePaymentsDueOnWindow(
      payments,
      window,
      referenceDate
    );

    if (duePayments.length === 0) {
      continue;
    }

    const payload = buildEmployeePaymentDueNotificationInput({
      companyId: context.companyId,
      count: duePayments.length,
      window,
      dateKey,
    });

    const outcome = await emitProactiveNotification(
      context.companyId,
      payload,
      context.notifyEmployeePayments
    );
    recordJobResult(items, context.companyId, "EMPLOYEE_PAYMENT_DUE", outcome);
  }
}

async function processMembershipNotifications(
  context: CompanyCronContext,
  referenceDate: Date,
  dateKey: string,
  items: CronJobResult[]
) {
  const subscription = await ensureCompanySubscription(context.companyId);
  const status = getMembershipStatus(subscription, referenceDate);
  const periodEnd = subscription.currentPeriodEnd;

  if (!periodEnd) {
    return;
  }

  if (status === "EXPIRED") {
    const payload = buildMembershipExpiredNotificationInput({
      companyId: context.companyId,
      dateKey,
    });
    const outcome = await emitProactiveNotification(
      context.companyId,
      payload,
      true
    );
    recordJobResult(items, context.companyId, "MEMBERSHIP_EXPIRED", outcome);
    return;
  }

  for (const window of MEMBERSHIP_EXPIRY_WINDOWS) {
    const targetDate = getMembershipExpiryDateForWindow(referenceDate, window);
    const targetKey = formatDateKey(targetDate);
    const periodEndKey = formatDateKey(periodEnd);

    if (targetKey !== periodEndKey) {
      continue;
    }

    const remainingDays = getRemainingMembershipDays(periodEnd, referenceDate);
    const payload = buildMembershipExpiringNotificationInput({
      companyId: context.companyId,
      remainingDays,
      window,
      dateKey,
    });
    const outcome = await emitProactiveNotification(
      context.companyId,
      payload,
      true
    );
    recordJobResult(items, context.companyId, "MEMBERSHIP_EXPIRING", outcome);
  }
}

async function processCompanyNotifications(
  context: CompanyCronContext,
  referenceDate: Date,
  items: CronJobResult[]
) {
  const dateKey = formatDateKey(referenceDate);

  await processLowStock(context, dateKey, items);
  await processDueInvoices(context, referenceDate, dateKey, items);
  await processLateCollections(context, referenceDate, dateKey, items);
  await processDailySummary(context, referenceDate, dateKey, items);
  await processEmployeePaymentDue(context, referenceDate, dateKey, items);
  await processMembershipNotifications(context, referenceDate, dateKey, items);
}

export async function runProactiveNotificationCron(
  referenceDate: Date = new Date()
): Promise<CronRunSummary> {
  const overdueResult =
    await updateOverdueEmployeePaymentsForActiveCompanies(referenceDate);

  const companies = await db.company.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      settings: {
        select: {
          defaultDueDays: true,
          notifyLowStock: true,
          notifyDueInvoices: true,
          notifyLateCollections: true,
          notifyDailySummary: true,
          notifyEmployeePayments: true,
        },
      },
    },
  });

  const items: CronJobResult[] = [];

  for (const company of companies) {
    const settings = company.settings;

    await processCompanyNotifications(
      {
        companyId: company.id,
        defaultDueDays: settings?.defaultDueDays ?? 30,
        notifyLowStock: settings?.notifyLowStock ?? true,
        notifyDueInvoices: settings?.notifyDueInvoices ?? true,
        notifyLateCollections: settings?.notifyLateCollections ?? true,
        notifyDailySummary: settings?.notifyDailySummary ?? false,
        notifyEmployeePayments: settings?.notifyEmployeePayments ?? true,
      },
      referenceDate,
      items
    );
  }

  const created = items.reduce((sum, item) => sum + item.created, 0);
  const skipped = items.reduce((sum, item) => sum + item.skipped, 0);

  return attachEmployeePaymentsOverdueSummary(
    {
      success: true,
      created,
      skipped,
      companiesScanned: companies.length,
      items,
    },
    overdueResult
  );
}
