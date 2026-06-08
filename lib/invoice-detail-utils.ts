import { parseNormalInvoiceMeta } from "@/lib/normal-invoice-meta";
import {
  calculateInvoiceTotals,
  formatMoney,
  type InvoiceLineItem,
} from "@/lib/invoice-form-utils";
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

export function buildInvoiceDetailView(invoice: InvoiceDetailRecord) {
  const { displayMessage, meta } = parseNormalInvoiceMeta(invoice.gibMessage);

  const items: InvoiceLineItem[] =
    meta?.items?.map((item, index) => ({
      id: `item-${index}`,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
    })) ?? [];

  const totals =
    items.length > 0
      ? calculateInvoiceTotals(items, meta?.discountAmount ?? 0)
      : {
          subtotal: invoice.total,
          discount: 0,
          vatTotal: 0,
          total: invoice.total,
        };

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
    formattedTotal: formatMoney(invoice.total),
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
  };
}
