import { roundMoney } from "@/lib/sale-payment-utils";

export type InvoiceLineInput = {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountRate?: number;
  discountAmount?: number;
};

export type InvoiceLineSnapshot = InvoiceLineInput & {
  discountRate: number;
  discountAmount: number;
  lineNetAmount: number;
  vatAmount: number;
  lineGrossAmount: number;
};

export type InvoiceHeaderTotals = {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalVat: number;
  grandTotal: number;
};

export function normalizeVatRate(value: number | string) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return 0;
  }

  return parsed;
}

export { roundMoney };

export function calculateInvoiceLineSnapshot(input: {
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discountRate?: number;
  discountAmount?: number;
  invoiceDiscountShare?: number;
}): InvoiceLineSnapshot {
  const quantity = input.quantity;
  const unitPrice = roundMoney(input.unitPrice);
  const vatRate = normalizeVatRate(input.vatRate);
  const lineBase = roundMoney(quantity * unitPrice);

  const explicitLineDiscount =
    input.discountAmount !== undefined
      ? roundMoney(input.discountAmount)
      : input.discountRate
        ? roundMoney((lineBase * normalizeVatRate(input.discountRate)) / 100)
        : 0;

  const invoiceDiscountShare = roundMoney(input.invoiceDiscountShare ?? 0);
  const discountAmount = roundMoney(explicitLineDiscount + invoiceDiscountShare);
  const lineNetAmount = roundMoney(Math.max(0, lineBase - discountAmount));
  const vatAmount = roundMoney((lineNetAmount * vatRate) / 100);
  const lineGrossAmount = roundMoney(lineNetAmount + vatAmount);

  return {
    quantity,
    unitPrice,
    vatRate,
    discountRate: normalizeVatRate(input.discountRate ?? 0),
    discountAmount,
    lineNetAmount,
    vatAmount,
    lineGrossAmount,
  };
}

export function calculateInvoiceLineSnapshots(
  items: InvoiceLineInput[],
  invoiceDiscountAmount = 0
): InvoiceLineSnapshot[] {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  );
  const invoiceDiscount = roundMoney(
    Math.min(Math.max(0, invoiceDiscountAmount), subtotal)
  );

  return items.map((item) => {
    const lineBase = roundMoney(item.quantity * item.unitPrice);
    const lineShare = subtotal > 0 ? lineBase / subtotal : 0;

    return calculateInvoiceLineSnapshot({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      discountRate: item.discountRate,
      discountAmount: item.discountAmount,
      invoiceDiscountShare: invoiceDiscount * lineShare,
    });
  });
}

export function calculateInvoiceTotals(
  items: InvoiceLineInput[],
  invoiceDiscountAmount = 0
): InvoiceHeaderTotals & {
  netSubtotal: number;
  vatTotal: number;
  total: number;
  discount: number;
} {
  const lines = calculateInvoiceLineSnapshots(items, invoiceDiscountAmount);
  return calculateInvoiceTotalsFromSnapshots(lines);
}

export function calculateInvoiceTotalsFromSnapshots(
  lines: InvoiceLineSnapshot[]
): InvoiceHeaderTotals & {
  netSubtotal: number;
  vatTotal: number;
  total: number;
  discount: number;
} {
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  );
  const totalDiscount = roundMoney(
    lines.reduce((sum, line) => sum + line.discountAmount, 0)
  );
  const taxableAmount = roundMoney(
    lines.reduce((sum, line) => sum + line.lineNetAmount, 0)
  );
  const totalVat = roundMoney(lines.reduce((sum, line) => sum + line.vatAmount, 0));
  const grandTotal = roundMoney(
    lines.reduce((sum, line) => sum + line.lineGrossAmount, 0)
  );

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    netSubtotal: taxableAmount,
    totalVat,
    vatTotal: totalVat,
    grandTotal,
    total: grandTotal,
    discount: totalDiscount,
  };
}

const MONEY_TOLERANCE = 0.01;

export function moneyEquals(left: number, right: number, tolerance = MONEY_TOLERANCE) {
  return Math.abs(roundMoney(left) - roundMoney(right)) <= tolerance;
}

export function assertInvoiceFinancialConsistency(input: {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalVat: number;
  grandTotal: number;
  items: Array<{
    lineNetAmount: number;
    discountAmount: number;
    vatAmount: number;
    lineGrossAmount: number;
  }>;
}) {
  const itemTaxable = roundMoney(
    input.items.reduce((sum, item) => sum + item.lineNetAmount, 0)
  );
  const itemDiscount = roundMoney(
    input.items.reduce((sum, item) => sum + item.discountAmount, 0)
  );
  const itemVat = roundMoney(
    input.items.reduce((sum, item) => sum + item.vatAmount, 0)
  );
  const itemGross = roundMoney(
    input.items.reduce((sum, item) => sum + item.lineGrossAmount, 0)
  );

  return {
    ok:
      moneyEquals(itemTaxable, input.taxableAmount) &&
      moneyEquals(itemDiscount, input.totalDiscount) &&
      moneyEquals(itemVat, input.totalVat) &&
      moneyEquals(itemGross, input.grandTotal),
    itemTaxable,
    itemDiscount,
    itemVat,
    itemGross,
  };
}

export function isInvoiceFinanciallyImmutable(status: string) {
  return status === "SENT" || status === "APPROVED" || status === "CANCELLED";
}
