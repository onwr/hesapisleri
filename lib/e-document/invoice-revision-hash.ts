import { createHash } from "node:crypto";
import type { Invoice, InvoiceItem } from "@prisma/client";
import type { InvoiceEDocumentSnapshots } from "@/lib/e-document/invoice-e-document-snapshot-types";
import { decimalFieldToXml } from "@/lib/e-document/ubl-tr/minor-units";

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return val;
  });
}

export function computeInvoiceRevisionHash(input: {
  invoice: Invoice;
  items: InvoiceItem[];
}): string {
  const payload = {
    invoiceId: input.invoice.id,
    customerId: input.invoice.customerId,
    invoiceNo: input.invoice.invoiceNo,
    type: input.invoice.type,
    status: input.invoice.status,
    financialSnapshotStatus: input.invoice.financialSnapshotStatus,
    subtotal: decimalFieldToXml(input.invoice.subtotal),
    totalDiscount: decimalFieldToXml(input.invoice.totalDiscount),
    taxableAmount: decimalFieldToXml(input.invoice.taxableAmount),
    totalVat: decimalFieldToXml(input.invoice.totalVat),
    total: decimalFieldToXml(input.invoice.total),
    items: input.items
      .slice()
      .sort((a, b) => a.lineIndex - b.lineIndex)
      .map((item) => ({
        lineIndex: item.lineIndex,
        productName: item.productName,
        description: item.description,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit,
        quantity: decimalFieldToXml(item.quantity),
        unitPrice: decimalFieldToXml(item.unitPrice),
        discountRate: decimalFieldToXml(item.discountRate),
        discountAmount: decimalFieldToXml(item.discountAmount),
        lineNetAmount: decimalFieldToXml(item.lineNetAmount),
        vatRate: decimalFieldToXml(item.vatRate),
        vatAmount: decimalFieldToXml(item.vatAmount),
        lineGrossAmount: decimalFieldToXml(item.lineGrossAmount),
      })),
  };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function computeSnapshotContentHash(snapshots: InvoiceEDocumentSnapshots): string {
  const payload = {
    sellerSnapshot: snapshots.sellerSnapshot,
    buyerSnapshot: snapshots.buyerSnapshot,
    lineSnapshots: snapshots.lineSnapshots,
    internetSaleSnapshot: snapshots.internetSaleSnapshot,
    financialSnapshot: snapshots.financialSnapshot,
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
