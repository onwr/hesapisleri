import type { Prisma } from "@prisma/client";
import {
  buildInvoiceSnapshotData,
  toInvoiceItemCreateData,
  type InvoiceLineCreateInput,
} from "@/lib/invoice-snapshot-utils";

type TransactionClient = Prisma.TransactionClient;

export async function persistInvoiceFinancialSnapshot(
  tx: TransactionClient,
  input: {
    invoiceId: string;
    items: InvoiceLineCreateInput[];
    invoiceDiscountAmount?: number;
  }
) {
  const snapshot = buildInvoiceSnapshotData(
    input.items,
    input.invoiceDiscountAmount ?? 0
  );

  await tx.invoiceItem.createMany({
    data: snapshot.items.map((entry, index) =>
      toInvoiceItemCreateData({
        invoiceId: input.invoiceId,
        item: entry,
        snapshot: entry.snapshot,
        lineIndex: index,
      })
    ),
  });

  await tx.invoice.update({
    where: { id: input.invoiceId },
    data: {
      subtotal: snapshot.header.subtotal,
      totalDiscount: snapshot.header.totalDiscount,
      taxableAmount: snapshot.header.taxableAmount,
      totalVat: snapshot.header.totalVat,
      total: snapshot.header.grandTotal,
      financialSnapshotStatus: snapshot.header.financialSnapshotStatus,
    },
  });

  return snapshot;
}
