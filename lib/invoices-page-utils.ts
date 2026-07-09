import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";
import { resolveInvoiceDetailActions } from "@/lib/invoice-lifecycle-utils";
import type { LifecycleActionMatrix } from "@/lib/transaction-lifecycle-policy";
import {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
} from "@/lib/sales-page-utils";
import { startOfDay } from "@/lib/dashboard-metrics";

export type InvoiceTabKey =
  | "all"
  | "draft"
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceTableRow = {
  id: string;
  invoiceNo: string;
  customerName: string;
  issueDate: Date;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  invoiceStatus: string;
  invoiceType: string;
  pdfUrl: string | null;
  saleId: string | null;
  detailHref: string;
  editHref: string;
  downloadHref: string;
  isOverdue: boolean;
  documentSubmission?: { status: string; documentType: string } | null;
};

export type InvoiceRowActionData = {
  id: string;
  invoiceNo: string;
  detailHref: string;
  editHref: string;
  downloadHref: string;
  pdfUrl: string | null;
  saleId: string | null;
  paymentStatus: string;
  invoiceStatus: string;
  invoiceType: string;
  canCancel: boolean;
  canCollect: boolean;
  canConvertToEInvoice: boolean;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  canDelete: boolean;
  canEdit: boolean;
  requiresCancelReason: boolean;
  providerCancelSupported: boolean;
  requiresProviderCancel: boolean;
  lifecycleActions: LifecycleActionMatrix;
  collectionsHref: string;
};

export function mapInvoiceRowActions(
  row: InvoiceTableRow & {
    documentSubmission?: { status: string; documentType: string } | null;
  }
): InvoiceRowActionData {
  const detail = resolveInvoiceDetailActions({
    status: row.invoiceStatus,
    paymentStatus: row.paymentStatus,
    type: row.invoiceType,
    paidAmount: row.paidAmount,
    total: row.amount,
    documentSubmission: row.documentSubmission ?? null,
  });

  const isCancelled = row.invoiceStatus === "CANCELLED";
  const isDraft = row.invoiceStatus === "DRAFT";
  const hasCollections =
    row.paidAmount > 0 ||
    (row.remainingAmount < row.amount && row.invoiceStatus !== "DRAFT");

  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    detailHref: row.detailHref,
    editHref: row.editHref,
    downloadHref: row.downloadHref,
    pdfUrl: row.pdfUrl,
    saleId: row.saleId,
    paymentStatus: row.paymentStatus,
    invoiceStatus: row.invoiceStatus,
    invoiceType: row.invoiceType,
    canCancel: detail.canCancel,
    canCollect:
      row.remainingAmount > 0 &&
      row.invoiceStatus !== "CANCELLED" &&
      row.invoiceStatus !== "DRAFT",
    canConvertToEInvoice:
      row.invoiceType === "NORMAL" && row.invoiceStatus !== "CANCELLED",
    totalAmount: row.amount,
    paidAmount: row.paidAmount,
    remainingAmount: row.remainingAmount,
    canDelete: detail.canDelete,
    canEdit: detail.canEdit,
    requiresCancelReason: detail.requiresCancelReason,
    providerCancelSupported: detail.providerCancelSupported,
    requiresProviderCancel: detail.requiresProviderCancel,
    lifecycleActions: {
      ...detail.lifecycleActions,
      edit: detail.canEdit,
      delete: detail.canDelete,
      cancel: detail.canCancel || detail.providerCancelSupported,
      view: true,
    },
    collectionsHref: `${row.detailHref}#collections`,
  };
}

export type InvoiceStatCard = {
  title: string;
  value: string;
  subtitle: string;
  iconKey: "file" | "receipt" | "clock" | "alert" | "calendar";
  color: "emerald" | "blue" | "orange" | "rose" | "violet";
};

export type InvoiceDistributionItem = {
  label: string;
  count: number;
  percent: number;
  color: string;
};

export type InvoiceActionCard = {
  title: string;
  description: string;
  href: string;
  iconKey: "filePlus" | "file" | "clock" | "alert" | "grid" | "eInvoice";
  color: "emerald" | "blue" | "orange" | "rose" | "violet";
};

export const INVOICE_TAB_LABELS: Record<InvoiceTabKey, string> = {
  all: "Tüm Faturalar",
  draft: "Taslak",
  pending: "Bekleyen",
  partial: "Kısmi Ödenmiş",
  paid: "Ödenmiş",
  overdue: "Geciken",
  cancelled: "İptal Edilen",
};

export const INVOICE_DISTRIBUTION_COLORS = {
  paid: "#22c55e",
  pending: "#3b82f6",
  partial: "#f97316",
  overdue: "#ef4444",
};

const DEFAULT_DUE_DAYS = 14;

export function parseInvoiceTab(value?: string | null): InvoiceTabKey {
  if (
    value === "draft" ||
    value === "pending" ||
    value === "partial" ||
    value === "paid" ||
    value === "overdue" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "all";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export { formatMoney as formatInvoiceMoney } from "@/lib/format-utils";

export function formatInvoiceDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getInvoiceDueDate(issueDate: Date, dueDate?: Date | null) {
  if (dueDate) return dueDate;

  const fallback = new Date(issueDate);
  fallback.setDate(fallback.getDate() + DEFAULT_DUE_DAYS);
  return fallback;
}

export function isInvoiceOverdue(
  paymentStatus: string,
  issueDate: Date,
  dueDate?: Date | null,
  referenceDate = new Date()
) {
  if (paymentStatus === "PAID") return false;

  const due = getInvoiceDueDate(issueDate, dueDate);
  return due.getTime() < startOfDay(referenceDate).getTime();
}

export function getPaymentText(status: string) {
  if (status === "PAID") return "Ödendi";
  if (status === "PARTIAL") return "Kısmi Ödenmiş";
  if (status === "FAILED") return "Başarısız";
  return "Beklemede";
}

export function getPaymentClass(status: string) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "PARTIAL") return "bg-orange-100 text-orange-700";
  if (status === "FAILED") return "bg-rose-100 text-rose-700";
  return "bg-blue-100 text-blue-700";
}

export function getInvoiceStatusText(status: string) {
  if (status === "DRAFT") return "Taslak";
  if (status === "SENT") return "Gönderildi";
  if (status === "APPROVED") return "Onaylandı";
  if (status === "CANCELLED") return "İptal";
  if (status === "ERROR") return "Hata";
  return status;
}

export function isInDateRange(date: Date, from: Date, to: Date) {
  const value = date.getTime();
  return value >= startOfDay(from).getTime() && value <= endOfDay(to).getTime();
}

export function matchesInvoiceSearch(
  invoice: {
    invoiceNo: string;
    customerName: string;
  },
  query: string
) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    invoice.invoiceNo.toLocaleLowerCase("tr-TR").includes(normalized) ||
    invoice.customerName.toLocaleLowerCase("tr-TR").includes(normalized)
  );
}

export function filterInvoicesByTab<T extends InvoiceTableRow>(
  rows: T[],
  tab: InvoiceTabKey
) {
  switch (tab) {
    case "draft":
      return rows.filter((row) => row.invoiceStatus === "DRAFT");
    case "pending":
      return rows.filter(
        (row) =>
          row.paymentStatus === "UNPAID" &&
          row.invoiceStatus !== "DRAFT" &&
          row.invoiceStatus !== "CANCELLED" &&
          !row.isOverdue
      );
    case "partial":
      return rows.filter((row) => row.paymentStatus === "PARTIAL");
    case "paid":
      return rows.filter((row) => row.paymentStatus === "PAID");
    case "overdue":
      return rows.filter((row) => row.isOverdue);
    case "cancelled":
      return rows.filter((row) => row.invoiceStatus === "CANCELLED");
    default:
      return rows;
  }
}

export function buildInvoiceDistribution(
  rows: InvoiceTableRow[]
): InvoiceDistributionItem[] {
  const paid = rows.filter((row) => row.paymentStatus === "PAID").length;
  const pending = rows.filter(
    (row) =>
      row.paymentStatus === "UNPAID" &&
      row.invoiceStatus !== "DRAFT" &&
      row.invoiceStatus !== "CANCELLED" &&
      !row.isOverdue
  ).length;
  const partial = rows.filter((row) => row.paymentStatus === "PARTIAL").length;
  const overdue = rows.filter((row) => row.isOverdue).length;
  const total = rows.length;

  const items = [
    { label: "Ödendi", count: paid, color: INVOICE_DISTRIBUTION_COLORS.paid },
    {
      label: "Beklemede",
      count: pending,
      color: INVOICE_DISTRIBUTION_COLORS.pending,
    },
    {
      label: "Kısmi Ödenmiş",
      count: partial,
      color: INVOICE_DISTRIBUTION_COLORS.partial,
    },
    {
      label: "Geciken",
      count: overdue,
      color: INVOICE_DISTRIBUTION_COLORS.overdue,
    },
  ];

  return items.map((item) => ({
    ...item,
    percent: total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0,
  }));
}

export function buildInvoicesQuery(params: {
  tab?: InvoiceTabKey;
  page?: number;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/invoices?${query}` : "/invoices";
}

export function buildInvoicesExportQuery(params: {
  tab?: InvoiceTabKey;
  from?: Date | string;
  to?: Date | string;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "all") {
    search.set("tab", params.tab);
  }

  if (params.from) {
    search.set(
      "from",
      typeof params.from === "string"
        ? params.from
        : formatDateInputValue(params.from)
    );
  }

  if (params.to) {
    search.set(
      "to",
      typeof params.to === "string" ? params.to : formatDateInputValue(params.to)
    );
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/api/invoices/export?${query}` : "/api/invoices/export";
}

export {
  formatDateDisplay,
  formatDateInputValue,
  normalizeDateRange,
  parseDateParam,
};
