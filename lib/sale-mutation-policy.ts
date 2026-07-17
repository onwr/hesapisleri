import type { Invoice, InvoiceDocumentSubmission, Sale } from "@prisma/client";
import { isCompletedSaleStatus } from "@/lib/sale-query-utils";

export type SaleWithInvoice = Sale & {
  invoice:
    | (Invoice & {
        documentSubmission: InvoiceDocumentSubmission | null;
      })
    | null;
};

export type SaleMutationBlockCode =
  | "NOT_FOUND"
  | "ALREADY_CANCELLED"
  | "ALREADY_REFUNDED"
  | "NOT_EDITABLE_STATUS"
  | "E_DOCUMENT_LOCKED"
  | "INVOICE_COLLECTED"
  | "HAS_REFUND_RECORD";

export type SaleMutationBlock = {
  ok: false;
  code: SaleMutationBlockCode;
  message: string;
};

export function getInvoiceEDocumentBlockMessage(invoice: SaleWithInvoice["invoice"]) {
  if (!invoice) return null;

  if (invoice.status === "APPROVED") {
    return "Onaylı e-fatura/e-arşiv belgesi olan satış düzenlenemez veya iptal edilemez. Önce fatura iptali veya iade sürecini tamamlayın.";
  }

  if (invoice.status === "SENT") {
    return "GİB'e gönderilmiş fatura olan satış düzenlenemez veya iptal edilemez. Önce fatura iptali sürecini tamamlayın.";
  }

  const submissionStatus = invoice.documentSubmission?.status;
  if (submissionStatus === "SUCCESS" || submissionStatus === "PENDING") {
    return "E-belge oluşturulmuş satış düzenlenemez veya iptal edilemez. Önce fatura/e-belge iptal sürecini tamamlayın.";
  }

  return null;
}

export function validateSaleEditEligibility(sale: SaleWithInvoice): SaleMutationBlock | { ok: true } {
  if (sale.status === "CANCELLED") {
    return {
      ok: false,
      code: "ALREADY_CANCELLED",
      message: "İptal edilmiş satış düzenlenemez.",
    };
  }

  if (sale.status === "REFUNDED" || sale.status === "PARTIALLY_REFUNDED") {
    return {
      ok: false,
      code: "HAS_REFUND_RECORD",
      message: "İade/değişim kaydı olan satış düzenlenemez.",
    };
  }

  if (!isCompletedSaleStatus(sale.status)) {
    return {
      ok: false,
      code: "NOT_EDITABLE_STATUS",
      message: "Yalnızca tamamlanmış satışlar düzenlenebilir.",
    };
  }

  const eDocumentMessage = getInvoiceEDocumentBlockMessage(sale.invoice);
  if (eDocumentMessage) {
    return {
      ok: false,
      code: "E_DOCUMENT_LOCKED",
      message: eDocumentMessage,
    };
  }

  if (
    sale.invoice &&
    (sale.invoice.paymentStatus === "PAID" ||
      sale.invoice.paymentStatus === "PARTIAL" ||
      Number(sale.invoice.paidAmount) > 0)
  ) {
    return {
      ok: false,
      code: "INVOICE_COLLECTED",
      message:
        "Faturası tahsil edilmiş satış düzenlenemez. Önce fatura tahsilatını düzenleyin veya fatura iptal sürecini uygulayın.",
    };
  }

  return { ok: true };
}

export function validateSaleCancelEligibility(
  sale: SaleWithInvoice
): SaleMutationBlock | { ok: true } {
  if (sale.status === "CANCELLED") {
    return {
      ok: false,
      code: "ALREADY_CANCELLED",
      message: "Bu satış zaten iptal edilmiş.",
    };
  }

  if (sale.status === "REFUNDED" || sale.status === "PARTIALLY_REFUNDED") {
    return {
      ok: false,
      code: "HAS_REFUND_RECORD",
      message: "İade/değişim kaydı olan satış iptal edilemez.",
    };
  }

  if (!isCompletedSaleStatus(sale.status) && sale.status !== "DRAFT") {
    return {
      ok: false,
      code: "NOT_EDITABLE_STATUS",
      message: "Bu satış durumunda iptal işlemi uygulanamaz.",
    };
  }

  const eDocumentMessage = getInvoiceEDocumentBlockMessage(sale.invoice);
  if (eDocumentMessage) {
    return {
      ok: false,
      code: "E_DOCUMENT_LOCKED",
      message: eDocumentMessage,
    };
  }

  return { ok: true };
}
