import { z } from "zod";
import type { PaymentStatus } from "@prisma/client";
import {
  derivePaymentStatus,
  getSaleRemainingAmount,
  roundMoney,
} from "@/lib/sale-payment-utils";
import { getInvoiceEffectivePaidAmount } from "@/lib/customer-balance-utils";

export const collectInvoiceSchema = z.object({
  accountId: z.string().trim().min(1, "Ödeme hesabı seçilmelidir."),
  amount: z.number().positive("Tahsilat tutarı 0'dan büyük olmalıdır."),
  collectedAt: z.string().optional(),
  note: z.string().optional(),
});

export type CollectInvoiceInput = z.infer<typeof collectInvoiceSchema>;

export function getInvoiceRemainingAmount(total: number, paidAmount: number) {
  return getSaleRemainingAmount(total, paidAmount);
}

export function resolveInvoicePaidState(total: number, paidAmount: number) {
  const cappedPaidAmount = roundMoney(Math.min(total, paidAmount));
  return {
    paidAmount: cappedPaidAmount,
    paymentStatus: derivePaymentStatus(total, cappedPaidAmount),
  };
}

export function normalizeInvoicePaymentFields(input: {
  total: number;
  paymentStatus: PaymentStatus | string;
  paidAmount?: number | null;
}) {
  const total = roundMoney(input.total);
  const paid = roundMoney(Number(input.paidAmount ?? 0));

  if (input.paymentStatus === "CANCELLED") {
    return { paidAmount: 0, paymentStatus: "UNPAID" as const };
  }

  if (input.paymentStatus === "PAID") {
    return { paidAmount: total, paymentStatus: "PAID" as const };
  }

  if (input.paymentStatus === "UNPAID" || input.paymentStatus === "FAILED") {
    return { paidAmount: 0, paymentStatus: "UNPAID" as const };
  }

  if (paid <= 0) {
    return { paidAmount: 0, paymentStatus: "UNPAID" as const };
  }

  if (paid >= total) {
    return { paidAmount: total, paymentStatus: "PAID" as const };
  }

  return { paidAmount: paid, paymentStatus: "PARTIAL" as const };
}

export function validateInvoiceCollectEligibility(invoice: {
  status: string;
  paymentStatus: string;
  total: unknown;
  paidAmount: unknown;
}) {
  if (invoice.status === "CANCELLED") {
    return {
      ok: false as const,
      message: "İptal edilmiş faturadan tahsilat alınamaz.",
    };
  }

  if (invoice.status === "DRAFT") {
    return {
      ok: false as const,
      message: "Taslak faturalardan tahsilat alınamaz.",
    };
  }

  const total = Number(invoice.total);
  const effectivePaid = getInvoiceEffectivePaidAmount(invoice);
  const remaining = getInvoiceRemainingAmount(total, effectivePaid);

  if (invoice.paymentStatus === "PAID" || remaining <= 0) {
    return {
      ok: false as const,
      message: "Bu faturanın tahsilatı tamamlanmış.",
    };
  }

  return { ok: true as const, remaining, effectivePaid, total };
}

export function validateInvoiceCancelEligibility(invoice: {
  status: string;
  paymentStatus: string;
  paidAmount: unknown;
  total: unknown;
}) {
  if (invoice.status === "CANCELLED") {
    return {
      ok: false as const,
      message: "Bu fatura zaten iptal edilmiş.",
    };
  }

  const effectivePaid = getInvoiceEffectivePaidAmount(invoice);

  if (
    invoice.paymentStatus === "PAID" ||
    invoice.paymentStatus === "PARTIAL" ||
    effectivePaid > 0
  ) {
    return {
      ok: false as const,
      message:
        "Tahsilat yapılmış faturalar önce tahsilat iadesi ile kapatılmalıdır.",
    };
  }

  return { ok: true as const };
}

export function buildInvoiceCollectionTitle(invoiceNo: string) {
  return `Fatura Tahsilatı - ${invoiceNo}`;
}

export function previewInvoicePaymentStatus(
  total: number,
  currentPaidAmount: number,
  collectAmount: number
) {
  const nextPaid = roundMoney(currentPaidAmount + collectAmount);
  return resolveInvoicePaidState(total, nextPaid);
}
