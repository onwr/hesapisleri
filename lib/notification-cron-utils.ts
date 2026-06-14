import type { NotificationPriority } from "@prisma/client";
import { resolveCollectionDueDate, startOfDay } from "@/lib/calendar-utils";
import { formatMoney } from "@/lib/format-utils";
import {
  isLowStock,
  resolveProductMinStock,
} from "@/lib/stocks-page-utils";

export type ProactiveNotificationType =
  | "LOW_STOCK"
  | "DUE_INVOICE"
  | "LATE_COLLECTION"
  | "DAILY_SUMMARY"
  | "EMPLOYEE_PAYMENT_DUE";

export type DueInvoiceWindow = "d-3" | "d-1" | "d0";

export const DUE_INVOICE_WINDOWS: DueInvoiceWindow[] = ["d-3", "d-1", "d0"];

export type EmployeePaymentDueWindow = "d-3" | "d-1" | "d0";

export const EMPLOYEE_PAYMENT_DUE_WINDOWS: EmployeePaymentDueWindow[] = [
  "d-3",
  "d-1",
  "d0",
];

export type CollectionRecord = {
  dueDate: Date;
  remaining: number;
};

export type DailySummaryStats = {
  salesCount: number;
  revenue: number;
  expenseCount: number;
  invoiceCount: number;
};

export type ProactiveNotificationPayload = {
  title: string;
  message: string;
  category: "STOCK" | "INVOICES" | "FINANCE" | "SYSTEM";
  module: string;
  entityType: string;
  actionUrl: string;
  priority: NotificationPriority;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
};

export function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(from: Date, to: Date) {
  const diff =
    startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function getDueDateForWindow(
  referenceDate: Date,
  window: DueInvoiceWindow
) {
  const today = startOfDay(referenceDate);

  if (window === "d-3") return addDays(today, 3);
  if (window === "d-1") return addDays(today, 1);
  return today;
}

export function buildLowStockDedupeKey(companyId: string, dateKey: string) {
  return `low-stock:${companyId}:${dateKey}`;
}

export function buildDueInvoiceDedupeKey(
  companyId: string,
  window: DueInvoiceWindow,
  dateKey: string
) {
  return `due-invoice:${companyId}:${window}:${dateKey}`;
}

export function buildLateCollectionDedupeKey(companyId: string, dateKey: string) {
  return `late-collection:${companyId}:${dateKey}`;
}

export function buildDailySummaryDedupeKey(companyId: string, dateKey: string) {
  return `daily-summary:${companyId}:${dateKey}`;
}

export function buildEmployeePaymentDueDedupeKey(
  companyId: string,
  window: EmployeePaymentDueWindow,
  dateKey: string
) {
  return `employee-payment-due:${companyId}:${window}:${dateKey}`;
}

export function countLowStockProducts(
  products: Array<{ stock: number; minStock: number; status: string }>
) {
  return products.filter(
    (product) =>
      product.status === "ACTIVE" &&
      isLowStock(product.stock, resolveProductMinStock(product.minStock))
  ).length;
}

export function filterInvoicesDueOnWindow<
  T extends { dueDate: Date | null; createdAt: Date },
>(
  invoices: T[],
  window: DueInvoiceWindow,
  referenceDate: Date,
  defaultDueDays: number
) {
  const targetDay = getDueDateForWindow(referenceDate, window);

  return invoices.filter((invoice) => {
    const dueDate = resolveCollectionDueDate({
      issueDate: invoice.createdAt,
      dueDate: invoice.dueDate,
      defaultDueDays,
    });

    return dueDate.getTime() === targetDay.getTime();
  });
}

export function filterOverdueCollections(
  records: CollectionRecord[],
  referenceDate: Date
) {
  const today = startOfDay(referenceDate);

  return records.filter(
    (record) => record.remaining > 0 && record.dueDate.getTime() < today.getTime()
  );
}

export function maxDaysOverdue(
  records: CollectionRecord[],
  referenceDate: Date
) {
  const overdue = filterOverdueCollections(records, referenceDate);
  if (overdue.length === 0) return 0;

  return Math.max(
    ...overdue.map((record) => daysBetween(record.dueDate, referenceDate))
  );
}

export function isWithinDay(date: Date, dayStart: Date, dayEnd: Date) {
  const time = date.getTime();
  return time >= dayStart.getTime() && time <= dayEnd.getTime();
}

export function computeDailySummaryStats(input: {
  sales: Array<{ total: unknown; createdAt: Date }>;
  expenses: Array<{ date: Date }>;
  invoices: Array<{ createdAt: Date }>;
  dayStart: Date;
  dayEnd: Date;
}): DailySummaryStats {
  const sales = input.sales.filter((sale) =>
    isWithinDay(sale.createdAt, input.dayStart, input.dayEnd)
  );
  const expenses = input.expenses.filter((expense) =>
    isWithinDay(expense.date, input.dayStart, input.dayEnd)
  );
  const invoices = input.invoices.filter((invoice) =>
    isWithinDay(invoice.createdAt, input.dayStart, input.dayEnd)
  );

  return {
    salesCount: sales.length,
    revenue: sales.reduce((sum, sale) => sum + Number(sale.total), 0),
    expenseCount: expenses.length,
    invoiceCount: invoices.length,
  };
}

export function buildLowStockMessage(count: number) {
  return `${count} ürün minimum stok seviyesinin altında.`;
}

export function buildDueInvoiceMessage(count: number, window: DueInvoiceWindow) {
  if (window === "d-1") {
    return `Yarın vadesi dolacak ${count} fatura var.`;
  }

  if (window === "d-3") {
    return `3 gün içinde vadesi dolacak ${count} fatura var.`;
  }

  return `Bugün vadesi dolacak ${count} fatura var.`;
}

export function buildLateCollectionMessage(count: number, overdueDays: number) {
  const days = Math.max(overdueDays, 1);
  return `${days} gündür tahsil edilmeyen ${count} kayıt var.`;
}

export function buildDailySummaryMessage(stats: DailySummaryStats) {
  const parts = [
    `${stats.salesCount} satış`,
    `${formatMoney(stats.revenue)} ciro`,
    `${stats.expenseCount} gider`,
  ];

  if (stats.invoiceCount > 0) {
    parts.push(`${stats.invoiceCount} fatura`);
  }

  return `Dün: ${parts.join(", ")}.`;
}

export function filterEmployeePaymentsDueOnWindow<
  T extends { dueDate: Date | null; status: string },
>(
  payments: T[],
  window: EmployeePaymentDueWindow,
  referenceDate: Date
) {
  const today = startOfDay(referenceDate);

  return payments.filter((payment) => {
    if (!payment.dueDate) return false;
    if (payment.status !== "PENDING" && payment.status !== "OVERDUE") {
      return false;
    }

    const due = startOfDay(payment.dueDate);

    if (window === "d0") {
      return due.getTime() <= today.getTime();
    }

    if (window === "d-1") {
      return due.getTime() === addDays(today, 1).getTime();
    }

    return due.getTime() === addDays(today, 3).getTime();
  });
}

export function buildEmployeePaymentDueMessage(
  count: number,
  window: EmployeePaymentDueWindow
) {
  if (window === "d-1") {
    return `Yarın vadesi gelecek ${count} çalışan ödemesi var.`;
  }

  if (window === "d-3") {
    return `3 gün içinde vadesi gelecek ${count} çalışan ödemesi var.`;
  }

  return `Bugün vadesi gelen ${count} çalışan ödemesi var.`;
}

export function getEmployeePaymentDuePriority(
  window: EmployeePaymentDueWindow
): NotificationPriority {
  return window === "d-3" ? "NORMAL" : "HIGH";
}

export function getDueInvoicePriority(
  window: DueInvoiceWindow
): NotificationPriority {
  return window === "d-3" ? "NORMAL" : "HIGH";
}

export function buildLowStockNotificationInput(input: {
  companyId: string;
  count: number;
  dateKey: string;
}): ProactiveNotificationPayload {
  return {
    title: "Düşük stok uyarısı",
    message: buildLowStockMessage(input.count),
    category: "STOCK",
    module: "stocks",
    entityType: "PRODUCT",
    actionUrl: "/stocks",
    priority: "HIGH",
    dedupeKey: buildLowStockDedupeKey(input.companyId, input.dateKey),
    metadata: { lowStockCount: input.count },
  };
}

export function buildDueInvoiceNotificationInput(input: {
  companyId: string;
  count: number;
  window: DueInvoiceWindow;
  dateKey: string;
}): ProactiveNotificationPayload {
  return {
    title: "Yaklaşan fatura vadeleri",
    message: buildDueInvoiceMessage(input.count, input.window),
    category: "INVOICES",
    module: "invoices",
    entityType: "INVOICE",
    actionUrl: "/invoices",
    priority: getDueInvoicePriority(input.window),
    dedupeKey: buildDueInvoiceDedupeKey(
      input.companyId,
      input.window,
      input.dateKey
    ),
    metadata: {
      dueInvoiceCount: input.count,
      window: input.window,
    },
  };
}

export function buildLateCollectionNotificationInput(input: {
  companyId: string;
  count: number;
  overdueDays: number;
  dateKey: string;
}): ProactiveNotificationPayload {
  return {
    title: "Geciken tahsilatlar",
    message: buildLateCollectionMessage(input.count, input.overdueDays),
    category: "FINANCE",
    module: "sales",
    entityType: "SALE",
    actionUrl: "/sales",
    priority: "CRITICAL",
    dedupeKey: buildLateCollectionDedupeKey(input.companyId, input.dateKey),
    metadata: {
      overdueCount: input.count,
      maxOverdueDays: input.overdueDays,
    },
  };
}

export function buildDailySummaryNotificationInput(input: {
  companyId: string;
  stats: DailySummaryStats;
  dateKey: string;
}): ProactiveNotificationPayload {
  return {
    title: "Günlük özet",
    message: buildDailySummaryMessage(input.stats),
    category: "SYSTEM",
    module: "dashboard",
    entityType: "DASHBOARD",
    actionUrl: "/dashboard",
    priority: "NORMAL",
    dedupeKey: buildDailySummaryDedupeKey(input.companyId, input.dateKey),
    metadata: {
      salesCount: input.stats.salesCount,
      revenue: input.stats.revenue,
      expenseCount: input.stats.expenseCount,
      invoiceCount: input.stats.invoiceCount,
    },
  };
}

export function buildEmployeePaymentDueNotificationInput(input: {
  companyId: string;
  count: number;
  window: EmployeePaymentDueWindow;
  dateKey: string;
}): ProactiveNotificationPayload {
  return {
    title: "Yaklaşan çalışan ödemeleri",
    message: buildEmployeePaymentDueMessage(input.count, input.window),
    category: "FINANCE",
    module: "employees",
    entityType: "EMPLOYEE_PAYMENT",
    actionUrl: "/team",
    priority: getEmployeePaymentDuePriority(input.window),
    dedupeKey: buildEmployeePaymentDueDedupeKey(
      input.companyId,
      input.window,
      input.dateKey
    ),
    metadata: {
      employeePaymentDueCount: input.count,
      window: input.window,
    },
  };
}
