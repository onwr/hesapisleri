import type { InvoiceItem } from "@prisma/client";
import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import {
  buildStoredInvoiceTotals,
  invoiceItemsToViewItems,
} from "@/lib/invoice-snapshot-utils";
import { formatMoney } from "@/lib/invoice-form-utils";
import {
  formatInvoiceDate,
  getInvoiceStatusText,
  getPaymentText,
} from "@/lib/invoices-page-utils";

export type InvoiceDetailRecord = {
  id: string;
  invoiceNo: string;
  type: string;
  status: string;
  paymentStatus: string;
  total: number;
  subtotal?: number;
  totalDiscount?: number;
  taxableAmount?: number;
  totalVat?: number;
  financialSnapshotStatus?: string;
  createdAt: Date;
  dueDate: Date | null;
  gibStatus: string | null;
  gibMessage: string | null;
  pdfUrl: string | null;
  saleId: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  company: {
    name: string;
    taxNo: string | null;
    address: string | null;
  };
};

export type InvoiceDetailViewItem = {
  id: string;
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  lineNetAmount: number;
  vatAmount: number;
  lineGrossAmount: number;
  discountAmount: number;
};

export function getInvoiceTypeLabel(type: string) {
  if (type === "E_INVOICE") return "e-Fatura";
  if (type === "E_ARCHIVE") return "e-Arşiv";
  return "Normal Fatura";
}

export function getDocumentLabel(metaLabel?: string) {
  if (metaLabel === "HIZMET") return "Hizmet Faturası";
  if (metaLabel === "PROFORMA") return "Proforma Fatura";
  if (metaLabel === "SATIS") return "Satış Faturası";
  return "Fatura";
}

export function getInvoiceEditHref(invoice: {
  id: string;
  status: string;
  type: string;
}) {
  if (invoice.status === "CANCELLED" || invoice.status === "APPROVED") {
    return `/invoices/${invoice.id}`;
  }

  if (invoice.type === "E_INVOICE" || invoice.type === "E_ARCHIVE") {
    return `/invoices/e-invoice?convertFrom=${invoice.id}`;
  }

  if (invoice.status === "DRAFT") {
    return `/invoices/new?edit=${invoice.id}`;
  }

  return `/invoices/${invoice.id}`;
}

function metaItemsToViewItems(
  meta: NonNullable<ReturnType<typeof parseNormalInvoiceMeta>["meta"]>
): InvoiceDetailViewItem[] {
  return (
    meta.items?.map((item, index) => ({
      id: `meta-item-${index}`,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      lineNetAmount:
        item.lineNetAmount ??
        item.quantity * item.unitPrice - (item.discountAmount ?? 0),
      vatAmount:
        item.vatAmount ??
        ((item.lineNetAmount ?? item.quantity * item.unitPrice) * item.vatRate) /
          100,
      lineGrossAmount:
        item.lineGrossAmount ??
        (item.lineNetAmount ?? item.quantity * item.unitPrice) +
          (item.vatAmount ?? 0),
      discountAmount: item.discountAmount ?? 0,
    })) ?? []
  );
}

function resolveTotalsFromMeta(
  meta: NonNullable<ReturnType<typeof parseNormalInvoiceMeta>["meta"]>,
  invoiceTotal: number
) {
  if (
    meta.subtotal !== undefined &&
    meta.totalVat !== undefined &&
    meta.grandTotal !== undefined
  ) {
    return {
      subtotal: meta.subtotal,
      discount: meta.discountAmount ?? 0,
      netSubtotal: meta.taxableAmount ?? meta.subtotal - (meta.discountAmount ?? 0),
      vatTotal: meta.totalVat,
      total: meta.grandTotal,
    };
  }

  // TODO: remove after invoice snapshot backfill is complete
  const items = metaItemsToViewItems(meta);
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  return {
    subtotal,
    discount: meta.discountAmount ?? 0,
    netSubtotal: subtotal - (meta.discountAmount ?? 0),
    vatTotal: items.reduce((sum, item) => sum + item.vatAmount, 0),
    total: invoiceTotal,
  };
}

export function buildInvoiceDetailView(
  invoice: InvoiceDetailRecord,
  options?: {
    dbItems?: InvoiceItem[];
  }
) {
  const { displayMessage, meta } = parseNormalInvoiceMeta(invoice.gibMessage);
  const dbItems = options?.dbItems ?? [];

  let items: InvoiceDetailViewItem[] = [];
  let totals: {
    subtotal: number;
    discount: number;
    netSubtotal: number;
    vatTotal: number;
    total: number;
  };

  if (dbItems.length > 0) {
    items = invoiceItemsToViewItems(dbItems);
    totals = buildStoredInvoiceTotals({
      subtotal: invoice.subtotal ?? 0,
      totalDiscount: invoice.totalDiscount ?? 0,
      taxableAmount: invoice.taxableAmount ?? 0,
      totalVat: invoice.totalVat ?? 0,
      total: invoice.total,
    });
  } else if (meta?.items?.length) {
    items = metaItemsToViewItems(meta);
    totals = resolveTotalsFromMeta(meta, invoice.total);
  } else {
    items = [];
    totals = {
      subtotal: invoice.total,
      discount: 0,
      netSubtotal: invoice.total,
      vatTotal: 0,
      total: invoice.total,
    };
  }

  return {
    displayMessage,
    meta,
    items,
    totals,
    issueDate: meta?.invoiceDate
      ? new Date(meta.invoiceDate)
      : invoice.createdAt,
    documentLabel: getDocumentLabel(meta?.documentLabel),
    typeLabel: getInvoiceTypeLabel(invoice.type),
    statusLabel: getInvoiceStatusText(invoice.status),
    paymentLabel: getPaymentText(invoice.paymentStatus),
    formattedTotal: formatMoney(totals.total),
    formattedSubtotal: formatMoney(totals.subtotal),
    formattedDiscount: formatMoney(totals.discount),
    formattedVat: formatMoney(totals.vatTotal),
    formattedIssueDate: formatInvoiceDate(
      meta?.invoiceDate ? new Date(meta.invoiceDate) : invoice.createdAt
    ),
    formattedDueDate: formatInvoiceDate(
      invoice.dueDate ??
        (() => {
          const fallback = new Date(invoice.createdAt);
          fallback.setDate(fallback.getDate() + 14);
          return fallback;
        })()
    ),
    usesStoredSnapshot:
      dbItems.length > 0 || invoice.financialSnapshotStatus === "COMPLETE",
  };
}
