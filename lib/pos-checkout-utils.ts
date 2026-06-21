import { z } from "zod";
import { roundMoney } from "@/lib/sale-payment-utils";
import type { SalePaymentMethod } from "@/lib/sale-payment-utils";
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

export const posCheckoutSchema = z.object({
  customerId: z.string().optional(),
  warehouseId: z.string().optional(),
  paymentMethod: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).default("CASH"),
  paymentStatus: z.enum(["PAID", "UNPAID", "PARTIAL"]).default("PAID"),
  collectedAmount: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  accountId: z.string().optional(),
  note: z.string().optional(),
  items: z.array(posItemSchema).min(1, "En az bir ürün ekleyin."),
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

export function mapPosPaymentMethodToCollectionMethod(
  method: PosPaymentMethod
): SalePaymentMethod {
  return method === "BANK_TRANSFER" ? "BANK" : "CASH";
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
  paymentMethod: PosPaymentMethod;
  paymentStatus: PosPaymentStatus;
  note?: string;
}) {
  const paymentText = getPosPaymentMethodLabel(input.paymentMethod);
  const statusText = getPosPaymentStatusLabel(input.paymentStatus);
  const base = `POS hızlı satış - ${paymentText} (${statusText})`;

  if (!input.note?.trim()) {
    return base;
  }

  return `${input.note.trim()} | ${base}`;
}
