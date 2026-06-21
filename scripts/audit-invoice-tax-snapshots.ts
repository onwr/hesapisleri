import { PrismaClient } from "@prisma/client";
import { parseNormalInvoiceMeta } from "../lib/normal-invoice-meta";
import {
  saleItemToInvoiceLineInput,
} from "../lib/invoice-snapshot-utils";
import { persistInvoiceFinancialSnapshot } from "../lib/invoice-snapshot-service";
import { assertInvoiceFinancialConsistency } from "../lib/invoice-tax-calculation-utils";

const db = new PrismaClient();
const shouldApply = process.argv.includes("--apply");

type AuditStats = {
  total: number;
  complete: number;
  inferred: number;
  needsReview: number;
  inconsistent: number;
};

async function backfillFromMeta(invoiceId: string, gibMessage: string | null) {
  const { meta } = parseNormalInvoiceMeta(gibMessage);
  if (!meta?.items?.length) {
    return false;
  }

  const lineItems = meta.items.map((item) => ({
    productId: item.productId,
    productName: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
  }));

  await db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await persistInvoiceFinancialSnapshot(tx, {
      invoiceId,
      items: lineItems,
      invoiceDiscountAmount: meta.discountAmount ?? 0,
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { financialSnapshotStatus: "INFERRED" },
    });
  });

  return true;
}

async function backfillFromSale(invoiceId: string, saleId: string) {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  if (!sale?.items.length) {
    return false;
  }

  const lineItems = sale.items.map((item) => saleItemToInvoiceLineInput(item));

  await db.$transaction(async (tx) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId } });
    await persistInvoiceFinancialSnapshot(tx, {
      invoiceId,
      items: lineItems,
      invoiceDiscountAmount: Number(sale.discount),
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { financialSnapshotStatus: "INFERRED" },
    });
  });

  return true;
}

async function main() {
  const stats: AuditStats = {
    total: 0,
    complete: 0,
    inferred: 0,
    needsReview: 0,
    inconsistent: 0,
  };

  const invoices = await db.invoice.findMany({
    include: {
      items: { orderBy: { lineIndex: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  stats.total = invoices.length;

  for (const invoice of invoices) {
    if (invoice.items.length > 0) {
      const consistency = assertInvoiceFinancialConsistency({
        subtotal: Number(invoice.subtotal),
        totalDiscount: Number(invoice.totalDiscount),
        taxableAmount: Number(invoice.taxableAmount),
        totalVat: Number(invoice.totalVat),
        grandTotal: Number(invoice.total),
        items: invoice.items.map((item) => ({
          lineNetAmount: Number(item.lineNetAmount),
          discountAmount: Number(item.discountAmount),
          vatAmount: Number(item.vatAmount),
          lineGrossAmount: Number(item.lineGrossAmount),
        })),
      });

      if (!consistency.ok) {
        stats.inconsistent += 1;
        console.log(
          `INCONSISTENT ${invoice.invoiceNo} (${invoice.id}) expectedVat=${invoice.totalVat} itemVat=${consistency.itemVat}`
        );
        continue;
      }

      if (invoice.financialSnapshotStatus === "COMPLETE") {
        stats.complete += 1;
      } else if (invoice.financialSnapshotStatus === "INFERRED") {
        stats.inferred += 1;
      } else {
        stats.needsReview += 1;
      }

      continue;
    }

    if (!shouldApply) {
      stats.needsReview += 1;
      console.log(`NEEDS_REVIEW ${invoice.invoiceNo} (${invoice.id})`);
      continue;
    }

    const fromMeta = await backfillFromMeta(invoice.id, invoice.gibMessage);
    if (fromMeta) {
      stats.inferred += 1;
      console.log(`BACKFILLED_META ${invoice.invoiceNo}`);
      continue;
    }

    if (invoice.saleId) {
      const fromSale = await backfillFromSale(invoice.id, invoice.saleId);
      if (fromSale) {
        stats.inferred += 1;
        console.log(`BACKFILLED_SALE ${invoice.invoiceNo}`);
        continue;
      }
    }

    stats.needsReview += 1;
    await db.invoice.update({
      where: { id: invoice.id },
      data: { financialSnapshotStatus: "NEEDS_REVIEW" },
    });
    console.log(`UNRESOLVED ${invoice.invoiceNo} (${invoice.id})`);
  }

  console.log("\nAudit summary:");
  console.log(JSON.stringify(stats, null, 2));

  if (!shouldApply) {
    console.log("\nDry-run tamamlandı. Uygulamak için --apply kullanın.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
