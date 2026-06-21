import type { InvoiceItem, Prisma } from "@prisma/client";
import type { FinancialSnapshotStatus } from "@prisma/client";
import {
  calculateInvoiceLineSnapshots,
  calculateInvoiceTotalsFromSnapshots,
  type InvoiceLineInput,
  type InvoiceLineSnapshot,
} from "@/lib/invoice-tax-calculation-utils";

export type InvoiceLineCreateInput = InvoiceLineInput & {
  productId?: string | null;
  productName: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  unit?: string | null;
  sourceSaleItemId?: string | null;
};

export type InvoiceSnapshotHeader = {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalVat: number;
  grandTotal: number;
  financialSnapshotStatus: FinancialSnapshotStatus;
};

export function saleItemToInvoiceLineInput(item: {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  vatRate: number;
}): InvoiceLineCreateInput {
  return {
    productId: item.productId,
    productName: item.name,
    sourceSaleItemId: item.id,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    vatRate: item.vatRate,
  };
}

export function buildInvoiceSnapshotData(
  items: InvoiceLineCreateInput[],
  invoiceDiscountAmount = 0
) {
  const lineInputs: InvoiceLineInput[] = items.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    discountRate: item.discountRate,
    discountAmount: item.discountAmount,
  }));

  const lineSnapshots = calculateInvoiceLineSnapshots(
    lineInputs,
    invoiceDiscountAmount
  );
  const header = calculateInvoiceTotalsFromSnapshots(lineSnapshots);

  return {
    lineSnapshots,
    header: {
      subtotal: header.subtotal,
      totalDiscount: header.totalDiscount,
      taxableAmount: header.taxableAmount,
      totalVat: header.totalVat,
      grandTotal: header.grandTotal,
      financialSnapshotStatus: "COMPLETE" as const,
    },
    items: items.map((item, index) => ({
      ...item,
      snapshot: lineSnapshots[index]!,
    })),
  };
}

export function toInvoiceItemCreateData(input: {
  invoiceId: string;
  item: InvoiceLineCreateInput;
  snapshot: InvoiceLineSnapshot;
  lineIndex: number;
}): Prisma.InvoiceItemCreateManyInput {
  const { item, snapshot, invoiceId, lineIndex } = input;

  return {
    invoiceId,
    productId: item.productId ?? null,
    sourceSaleItemId: item.sourceSaleItemId ?? null,
    productName: item.productName,
    description: item.description ?? null,
    sku: item.sku ?? null,
    barcode: item.barcode ?? null,
    unit: item.unit ?? null,
    quantity: snapshot.quantity,
    unitPrice: snapshot.unitPrice,
    discountRate: snapshot.discountRate,
    discountAmount: snapshot.discountAmount,
    lineNetAmount: snapshot.lineNetAmount,
    vatRate: snapshot.vatRate,
    vatAmount: snapshot.vatAmount,
    lineGrossAmount: snapshot.lineGrossAmount,
    lineIndex,
  };
}

export function serializeInvoiceItem(item: InvoiceItem) {
  return {
    id: item.id,
    productId: item.productId,
    name: item.productName,
    description: item.description,
    sku: item.sku,
    barcode: item.barcode,
    unit: item.unit,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discountRate: Number(item.discountRate),
    discountAmount: Number(item.discountAmount),
    lineNetAmount: Number(item.lineNetAmount),
    vatRate: Number(item.vatRate),
    vatAmount: Number(item.vatAmount),
    lineGrossAmount: Number(item.lineGrossAmount),
    lineIndex: item.lineIndex,
  };
}

export function invoiceItemsToLineInputs(
  items: InvoiceItem[]
): InvoiceLineInput[] {
  return items
    .slice()
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .map((item) => ({
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      vatRate: Number(item.vatRate),
      discountRate: Number(item.discountRate),
      discountAmount: Number(item.discountAmount),
    }));
}

export function invoiceItemsToViewItems(items: InvoiceItem[]) {
  return items
    .slice()
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .map((item) => {
      const serialized = serializeInvoiceItem(item);

      return {
        id: serialized.id,
        productId: serialized.productId ?? undefined,
        name: serialized.name,
        quantity: serialized.quantity,
        unitPrice: serialized.unitPrice,
        vatRate: serialized.vatRate,
        lineNetAmount: serialized.lineNetAmount,
        vatAmount: serialized.vatAmount,
        lineGrossAmount: serialized.lineGrossAmount,
        discountAmount: serialized.discountAmount,
      };
    });
}

export function buildStoredInvoiceTotals(invoice: {
  subtotal: Prisma.Decimal | number;
  totalDiscount: Prisma.Decimal | number;
  taxableAmount: Prisma.Decimal | number;
  totalVat: Prisma.Decimal | number;
  total: Prisma.Decimal | number;
}) {
  return {
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.totalDiscount),
    netSubtotal: Number(invoice.taxableAmount),
    vatTotal: Number(invoice.totalVat),
    total: Number(invoice.total),
    taxableAmount: Number(invoice.taxableAmount),
    totalVat: Number(invoice.totalVat),
    grandTotal: Number(invoice.total),
  };
}
