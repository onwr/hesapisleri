import { roundMoney } from "@/lib/sale-payment-utils";
import { parseTurkishMoneyInput } from "@/lib/money-input-utils";

export type SaleDiscountType = "AMOUNT" | "PERCENT";

export type SaleLineItemInput = {
  quantity: number;
  unitPrice: number;
  vatRate: number;
};

export type SaleCalculationItem = SaleLineItemInput & {
  productId?: string;
  name?: string;
  discountType?: SaleDiscountType;
  discountValue?: number;
};

export type SaleDiscountInput = {
  type?: SaleDiscountType;
  value?: number;
};

export type SaleTotals = {
  subtotal: number;
  vatTotal: number;
  gross: number;
  discount: number;
  total: number;
};

export const SALE_VAT_PRESETS = [0, 1, 10, 20] as const;

export function calculateLineSubtotal(item: SaleLineItemInput) {
  return roundMoney(item.quantity * item.unitPrice);
}

export function calculateLineVat(item: SaleLineItemInput) {
  const lineSubtotal = calculateLineSubtotal(item);
  return roundMoney((lineSubtotal * item.vatRate) / 100);
}

export function calculateLineTotal(item: SaleLineItemInput) {
  return roundMoney(calculateLineSubtotal(item) + calculateLineVat(item));
}

export function calculateSaleSubtotal(items: SaleLineItemInput[]) {
  return roundMoney(
    items.reduce((sum, item) => sum + calculateLineSubtotal(item), 0)
  );
}

export function calculateSaleVatTotal(items: SaleLineItemInput[]) {
  return roundMoney(
    items.reduce((sum, item) => sum + calculateLineVat(item), 0)
  );
}

export function calculateSaleDiscountAmount(
  gross: number,
  discountInput?: SaleDiscountInput
) {
  const type = discountInput?.type ?? "AMOUNT";
  const rawValue = discountInput?.value ?? 0;

  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return 0;
  }

  if (type === "PERCENT") {
    const percent = Math.min(100, Math.max(0, rawValue));
    return roundMoney(Math.min(gross, (gross * percent) / 100));
  }

  return roundMoney(Math.min(gross, rawValue));
}

export function calculateSaleTotals(
  items: SaleLineItemInput[],
  discountInput?: SaleDiscountInput
): SaleTotals {
  const subtotal = calculateSaleSubtotal(items);
  const vatTotal = calculateSaleVatTotal(items);
  const gross = roundMoney(subtotal + vatTotal);
  const discount = calculateSaleDiscountAmount(gross, discountInput);
  const total = roundMoney(gross - discount);

  return {
    subtotal,
    vatTotal,
    gross,
    discount,
    total,
  };
}

export function parseSaleUnitPriceInput(value: string) {
  if (!value.trim()) return 0;

  const parsed = parseTurkishMoneyInput(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function parseSaleVatRateInput(value: string | number) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

export function parseSaleDiscountValueInput(
  value: string,
  type: SaleDiscountType = "AMOUNT"
) {
  if (!value.trim()) return 0;

  const parsed =
    type === "PERCENT"
      ? Number(value.replace(",", "."))
      : parseTurkishMoneyInput(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function validateSaleLineItem(item: SaleLineItemInput): string | null {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    return "Miktar 0'dan büyük olmalıdır.";
  }

  if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    return "Birim fiyat geçersiz.";
  }

  if (
    !Number.isFinite(item.vatRate) ||
    item.vatRate < 0 ||
    item.vatRate > 100
  ) {
    return "KDV oranı 0 ile 100 arasında olmalıdır.";
  }

  return null;
}

export function validateSaleLineItems(items: SaleLineItemInput[]): string | null {
  for (const item of items) {
    const error = validateSaleLineItem(item);
    if (error) return error;
  }

  return null;
}

export function validateSaleDiscountInput(
  gross: number,
  discountInput?: SaleDiscountInput
): string | null {
  const type = discountInput?.type ?? "AMOUNT";
  const value = discountInput?.value ?? 0;

  if (!Number.isFinite(value) || value < 0) {
    return "İndirim tutarı geçersiz.";
  }

  if (value === 0) {
    return null;
  }

  if (type === "PERCENT") {
    if (value > 100) {
      return "İndirim yüzdesi 0 ile 100 arasında olmalıdır.";
    }
    return null;
  }

  if (value > gross) {
    return "İndirim tutarı satış toplamını aşamaz.";
  }

  return null;
}

export function resolveSaleDiscountInput(input: {
  discount?: number;
  discountType?: SaleDiscountType;
  discountValue?: number;
}): SaleDiscountInput {
  if (input.discountType === "PERCENT" && input.discountValue !== undefined) {
    return { type: "PERCENT", value: input.discountValue };
  }

  const amount =
    input.discountValue !== undefined ? input.discountValue : input.discount ?? 0;

  return { type: "AMOUNT", value: amount };
}

export function isSaleVatPreset(rate: number) {
  return SALE_VAT_PRESETS.includes(rate as (typeof SALE_VAT_PRESETS)[number]);
}
