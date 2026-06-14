import {
  getSaleRemainingAmount,
  roundMoney,
  derivePaymentStatus,
} from "@/lib/sale-payment-utils";
import { getInvoiceRemainingAmount } from "@/lib/invoice-payment-utils";

export type CollectionDocumentType = "SALE" | "INVOICE";

export type CollectionPaymentStatusFilter = "ALL" | "UNPAID" | "PARTIAL";

export type CollectionDueStatusFilter =
  | "ALL"
  | "OVERDUE"
  | "DUE_TODAY"
  | "UPCOMING";

export type PendingCollectionItem = {
  id: string;
  documentType: CollectionDocumentType;
  documentId: string;
  documentNo: string;
  customerId: string | null;
  customerName: string;
  issueDate: Date;
  dueDate: Date | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  isOverdue: boolean;
  isDueToday: boolean;
  actionUrl: string;
  collectTarget: {
    type: CollectionDocumentType;
    id: string;
  };
  linkedInvoiceId: string | null;
  linkedSaleId: string | null;
};

export type PendingCollectionsSummary = {
  pendingCount: number;
  pendingTotal: number;
  overdueCount: number;
  dueTodayCount: number;
  partialCount: number;
};

export type PendingCollectionsFilters = {
  search?: string;
  customerId?: string;
  documentType?: CollectionDocumentType | "ALL";
  paymentStatus?: CollectionPaymentStatusFilter;
  dueStatus?: CollectionDueStatusFilter;
  from?: Date | null;
  to?: Date | null;
};

export function previewSalePaymentStatus(
  total: number,
  paidAmount: number,
  collectAmount: number
) {
  const nextPaid = roundMoney(Math.min(total, paidAmount + collectAmount));
  return {
    paidAmount: nextPaid,
    paymentStatus: derivePaymentStatus(total, nextPaid),
  };
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function computeDueFlags(dueDate: Date | null, now = new Date()) {
  if (!dueDate) {
    return { isOverdue: false, isDueToday: false };
  }

  const today = startOfDay(now);
  const due = startOfDay(dueDate);

  return {
    isOverdue: due < today,
    isDueToday: isSameCalendarDay(due, today),
  };
}

export function computePendingCollectionsSummary(
  items: PendingCollectionItem[]
): PendingCollectionsSummary {
  return {
    pendingCount: items.length,
    pendingTotal: roundMoney(
      items.reduce((sum, item) => sum + item.remainingAmount, 0)
    ),
    overdueCount: items.filter((item) => item.isOverdue).length,
    dueTodayCount: items.filter((item) => item.isDueToday).length,
    partialCount: items.filter((item) => item.paymentStatus === "PARTIAL")
      .length,
  };
}

export function filterPendingCollections(
  items: PendingCollectionItem[],
  filters: PendingCollectionsFilters
): PendingCollectionItem[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const documentType = filters.documentType ?? "ALL";
  const paymentStatus = filters.paymentStatus ?? "ALL";
  const dueStatus = filters.dueStatus ?? "ALL";

  return items.filter((item) => {
    if (search) {
      const haystack = [
        item.documentNo,
        item.customerName,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (filters.customerId && item.customerId !== filters.customerId) {
      return false;
    }

    if (documentType !== "ALL" && item.documentType !== documentType) {
      return false;
    }

    if (paymentStatus !== "ALL" && item.paymentStatus !== paymentStatus) {
      return false;
    }

    if (dueStatus === "OVERDUE" && !item.isOverdue) {
      return false;
    }

    if (dueStatus === "DUE_TODAY" && !item.isDueToday) {
      return false;
    }

    if (dueStatus === "UPCOMING") {
      if (!item.dueDate || item.isOverdue || item.isDueToday) {
        return false;
      }
    }

    if (filters.from) {
      const from = startOfDay(filters.from);
      if (item.issueDate < from) {
        return false;
      }
    }

    if (filters.to) {
      const to = endOfDay(filters.to);
      if (item.issueDate > to) {
        return false;
      }
    }

    return true;
  });
}

export function getCollectionPaymentBadgeClass(status: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "PARTIAL") return "bg-blue-50 text-blue-700 ring-blue-100";
  return "bg-amber-50 text-amber-700 ring-amber-100";
}

export function getCollectionPaymentLabel(status: string) {
  if (status === "PAID") return "Ödendi";
  if (status === "PARTIAL") return "Kısmi";
  return "Bekliyor";
}

export function getCollectionDocumentBadgeClass(type: CollectionDocumentType) {
  return type === "INVOICE"
    ? "bg-violet-50 text-violet-700 ring-violet-100"
    : "bg-sky-50 text-sky-700 ring-sky-100";
}

export function getCollectionDocumentLabel(type: CollectionDocumentType) {
  return type === "INVOICE" ? "Fatura" : "Satış";
}

export function saleHasCollectibleInvoice(invoice: {
  id: string;
  status: string;
  paymentStatus: string;
  total: unknown;
  paidAmount: unknown;
} | null | undefined) {
  if (!invoice) return false;
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
    return false;
  }

  const remaining = getInvoiceRemainingAmount(
    Number(invoice.total),
    Number(invoice.paidAmount)
  );

  return remaining > 0;
}

export function resolveSaleCollectTarget(sale: {
  id: string;
  invoice: {
    id: string;
    status: string;
    paymentStatus: string;
    total: unknown;
    paidAmount: unknown;
  } | null;
}) {
  if (saleHasCollectibleInvoice(sale.invoice)) {
    return {
      type: "INVOICE" as const,
      id: sale.invoice!.id,
      viaInvoice: true,
    };
  }

  return {
    type: "SALE" as const,
    id: sale.id,
    viaInvoice: false,
  };
}

export function mapInvoiceToPendingItem(invoice: {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  customer: { name: string } | null;
  createdAt: Date;
  dueDate: Date | null;
  total: unknown;
  paidAmount: unknown;
  paymentStatus: string;
  saleId: string | null;
}): PendingCollectionItem | null {
  const totalAmount = Number(invoice.total);
  const paidAmount = Number(invoice.paidAmount);
  const remainingAmount = getInvoiceRemainingAmount(totalAmount, paidAmount);

  if (remainingAmount <= 0) {
    return null;
  }

  const { isOverdue, isDueToday } = computeDueFlags(invoice.dueDate);

  return {
    id: `invoice-${invoice.id}`,
    documentType: "INVOICE",
    documentId: invoice.id,
    documentNo: invoice.invoiceNo,
    customerId: invoice.customerId,
    customerName: invoice.customer?.name ?? "Müşteri seçilmedi",
    issueDate: invoice.createdAt,
    dueDate: invoice.dueDate,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus: invoice.paymentStatus,
    isOverdue,
    isDueToday,
    actionUrl: `/invoices/${invoice.id}`,
    collectTarget: { type: "INVOICE", id: invoice.id },
    linkedInvoiceId: invoice.id,
    linkedSaleId: invoice.saleId,
  };
}

export function mapSaleToPendingItem(sale: {
  id: string;
  saleNo: string;
  customerId: string | null;
  customer: { name: string } | null;
  createdAt: Date;
  total: unknown;
  paidAmount: unknown;
  paymentStatus: string;
}): PendingCollectionItem | null {
  const totalAmount = Number(sale.total);
  const paidAmount = Number(sale.paidAmount);
  const remainingAmount = getSaleRemainingAmount(totalAmount, paidAmount);

  if (remainingAmount <= 0) {
    return null;
  }

  return {
    id: `sale-${sale.id}`,
    documentType: "SALE",
    documentId: sale.id,
    documentNo: sale.saleNo,
    customerId: sale.customerId,
    customerName: sale.customer?.name ?? "Müşteri seçilmedi",
    issueDate: sale.createdAt,
    dueDate: null,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus: sale.paymentStatus,
    isOverdue: false,
    isDueToday: false,
    actionUrl: `/sales/${sale.id}`,
    collectTarget: { type: "SALE", id: sale.id },
    linkedInvoiceId: null,
    linkedSaleId: sale.id,
  };
}
