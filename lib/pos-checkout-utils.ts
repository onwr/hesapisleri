import { z } from "zod";
import { roundMoney } from "@/lib/sale-payment-utils";
import {
  calculateSaleTotals,
  type SaleLineItemInput,
} from "@/lib/sale-calculation-utils";

export type PosPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";
export type PosPaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export const posItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).max(100).default(20),
});

export const posPaymentLineSchema = z.object({
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]),
  amount: z.number().positive("Ödeme tutarı sıfırdan büyük olmalıdır."),
  accountId: z.string().min(1, "Tahsilat hesabı seçilmelidir."),
});

export type PosPaymentLineInput = z.infer<typeof posPaymentLineSchema>;

export const posCheckoutSchema = z
  .object({
    customerId: z.string().optional(),
    warehouseId: z.string().optional(),
    paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("PAID"),
    collectedAmount: z.number().min(0).optional(),
    discount: z.number().min(0).default(0),
    note: z.string().optional(),
    items: z.array(posItemSchema).min(1, "En az bir ürün ekleyin."),
    payments: z.array(posPaymentLineSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const totals = calculatePosTotals(data.items, data.discount);
    const paymentError = validatePosCheckoutPayments({
      payments: data.payments,
      paymentStatus: data.paymentStatus,
      total: totals.total,
      collectedAmount: data.collectedAmount,
    });

    if (paymentError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: paymentError,
        path: ["payments"],
      });
    }
  });

export type PosCheckoutInput = z.infer<typeof posCheckoutSchema>;

export type PosCartItemInput = SaleLineItemInput;

export type PosTotals = {
  subtotal: number;
  vatTotal: number;
  discount: number;
  total: number;
};

export function generatePosSaleNo() {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `POS-${year}-${random}`;
}

export function calculatePosTotals(
  items: PosCartItemInput[],
  discountInput = 0
): PosTotals {
  const totals = calculateSaleTotals(items, {
    type: "AMOUNT",
    value: discountInput,
  });

  return {
    subtotal: totals.subtotal,
    vatTotal: totals.vatTotal,
    discount: totals.discount,
    total: totals.total,
  };
}

export function sumPosPaymentAmounts(payments: Array<{ amount: number }>) {
  return roundMoney(
    payments.reduce((sum, payment) => sum + payment.amount, 0)
  );
}

export function validatePosCheckoutPayments(input: {
  payments: PosPaymentLineInput[];
  paymentStatus: PosPaymentStatus;
  total: number;
  collectedAmount?: number;
}) {
  const total = roundMoney(input.total);

  if (input.paymentStatus === "UNPAID") {
    if (input.payments.length > 0) {
      return "Ödenmemiş satışta tahsilat satırı gönderilemez.";
    }
    return null;
  }

  if (input.payments.length === 0) {
    return "Tahsilat için en az bir ödeme satırı ve hesap seçimi gerekir.";
  }

  const expectedPaid =
    input.paymentStatus === "PARTIAL"
      ? roundMoney(input.collectedAmount ?? 0)
      : total;

  if (expectedPaid <= 0) {
    return "Kısmi ödeme için tahsil edilen tutar sıfırdan büyük olmalıdır.";
  }

  const paidTotal = sumPosPaymentAmounts(input.payments);

  if (paidTotal !== expectedPaid) {
    return `Ödeme satırlarının toplamı (${paidTotal}) beklenen tahsilat tutarına (${expectedPaid}) eşit olmalıdır.`;
  }

  return null;
}

export function getPosPaymentMethodLabel(method: PosPaymentMethod) {
  if (method === "CASH") return "Nakit";
  if (method === "CARD") return "Kart";
  if (method === "BANK_TRANSFER") return "Havale/EFT";
  return method;
}

export function getPosPaymentStatusLabel(status: PosPaymentStatus) {
  if (status === "PAID") return "Ödendi";
  if (status === "UNPAID") return "Veresiye / Ödenmedi";
  return "Kısmi Ödeme";
}

export function posRequiresCollectionAccount(
  paymentStatus: PosPaymentStatus,
  paidAmount: number
) {
  return paymentStatus !== "UNPAID" && roundMoney(paidAmount) > 0;
}

export function buildPosSaleItemTotal(item: PosCartItemInput) {
  const itemSubtotal = item.quantity * item.unitPrice;
  const itemVat = (itemSubtotal * item.vatRate) / 100;
  return roundMoney(itemSubtotal + itemVat);
}

export function buildPosSaleNote(input: {
  payments: PosPaymentLineInput[];
  paymentStatus: PosPaymentStatus;
  note?: string;
}) {
  const methodLabels = [
    ...new Set(
      input.payments.map((payment) =>
        getPosPaymentMethodLabel(payment.paymentMethod)
      )
    ),
  ];
  const paymentText =
    methodLabels.length > 0 ? methodLabels.join(" + ") : "Ödeme yok";
  const statusText = getPosPaymentStatusLabel(input.paymentStatus);
  const base = `POS hızlı satış - ${paymentText} (${statusText})`;

  if (!input.note?.trim()) {
    return base;
  }

  return `${input.note.trim()} | ${base}`;
}
