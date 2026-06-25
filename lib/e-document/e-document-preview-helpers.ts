import type { InvoiceInternetSaleSnapshot } from "@/lib/e-document/invoice-e-document-snapshot-types";
import type { EDocumentPreviewInput } from "@/lib/e-document/e-document-preview-types";
import type { UblProfileId, UblInvoiceTypeCode } from "@/lib/e-document/ubl-tr/ubl-tr-version";
import { SUPPORTED_INVOICE_TYPE_CODES } from "@/lib/e-document/ubl-tr/ubl-tr-version";

export function resolveProfileId(
  documentType: "E_INVOICE" | "E_ARCHIVE",
  commercial = false
): UblProfileId {
  if (documentType === "E_ARCHIVE") return "EARSIVFATURA";
  return commercial ? "TICARIFATURA" : "TEMELFATURA";
}

export function resolveInvoiceTypeCode(input: {
  requested?: UblInvoiceTypeCode;
  invoiceType?: string;
}): UblInvoiceTypeCode {
  if (input.requested && SUPPORTED_INVOICE_TYPE_CODES.includes(input.requested)) {
    return input.requested;
  }
  if (input.invoiceType === "IADE") return "IADE";
  return "SATIS";
}

export function buildInternetSaleSnapshotFromInput(
  input: EDocumentPreviewInput
): InvoiceInternetSaleSnapshot | null {
  if (!input.internetSale) return null;

  return {
    orderNumber: input.internetSaleOrderNumber?.trim() || undefined,
    orderDate: input.internetSaleOrderDate?.trim() || undefined,
    webAddress: input.internetSaleWebAddress?.trim() || undefined,
    paymentMethod: input.internetSalePaymentMethod?.trim() || undefined,
    paymentDate: input.internetSalePaymentDate?.trim() || undefined,
    paymentAgent: input.internetSalePaymentAgent?.trim() || undefined,
    carrier: input.internetSaleCarrier?.trim() || undefined,
    shippingInfo: input.internetSaleShippingInfo?.trim() || undefined,
    deliveryInfo: input.internetSaleDeliveryInfo?.trim() || undefined,
  };
}

export function buildInternetSaleIssues(input: {
  internetSale?: boolean;
  snapshot?: InvoiceInternetSaleSnapshot | null;
}) {
  const issues: Array<{ field: string; message: string }> = [];
  if (!input.internetSale) return issues;

  const snapshot = input.snapshot;
  const required: Array<{ field: keyof InvoiceInternetSaleSnapshot; label: string }> = [
    { field: "orderNumber", label: "Sipariş numarası" },
    { field: "orderDate", label: "Sipariş tarihi" },
    { field: "webAddress", label: "Web satış adresi" },
    { field: "paymentMethod", label: "Ödeme yöntemi" },
    { field: "paymentDate", label: "Ödeme tarihi" },
    { field: "carrier", label: "Kargo/taşıyıcı" },
    { field: "shippingInfo", label: "Gönderim bilgisi" },
  ];

  for (const item of required) {
    if (!snapshot?.[item.field]?.trim()) {
      issues.push({
        field: `internetSale.${item.field}`,
        message: `İnternet satışı için ${item.label} snapshot alanı zorunludur.`,
      });
    }
  }

  return issues;
}
