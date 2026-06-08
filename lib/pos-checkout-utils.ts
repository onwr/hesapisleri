import { z } from "zod";
import { roundMoney } from "@/lib/sale-payment-utils";
import type { SalePaymentMethod } from "@/lib/sale-payment-utils";

export type PosPaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";
export type PosPaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export const posItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
  vatRate: z.number().min(0).default(20),
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

export type PosCartItemInput = {
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

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
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  );

  const vatTotal = roundMoney(
    items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      return sum + (itemTotal * item.vatRate) / 100;
    }, 0)
  );

  const gross = roundMoney(subtotal + vatTotal);
  const discount = roundMoney(Math.min(discountInput, gross));
  const total = roundMoney(gross - discount);

  return {
    subtotal,
    vatTotal,
    discount,
    total,
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
