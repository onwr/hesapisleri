import { db } from "@/lib/prisma";
import {
  activeInvoiceStatusFilter,
  activeSaleStatusFilter,
} from "@/lib/sale-query-utils";
import {
  filterPendingCollections,
  mapInvoiceToPendingItem,
  mapSaleToPendingItem,
  saleHasCollectibleInvoice,
  computePendingCollectionsSummary,
  type PendingCollectionItem,
  type PendingCollectionsFilters,
  type PendingCollectionsSummary,
} from "@/lib/collections-utils";

export async function getPendingCollections(
  companyId: string,
  filters: PendingCollectionsFilters = {}
): Promise<{
  items: PendingCollectionItem[];
  summary: PendingCollectionsSummary;
}> {
  const [sales, invoices] = await Promise.all([
    db.sale.findMany({
      where: {
        companyId,
        ...activeSaleStatusFilter(),
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      },
      include: {
        customer: true,
        invoice: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({
      where: {
        companyId,
        ...activeInvoiceStatusFilter(),
        status: { not: "DRAFT" },
        paymentStatus: { in: ["UNPAID", "PARTIAL"] },
      },
      include: {
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const saleIdsRepresentedByInvoice = new Set<string>();

  for (const invoice of invoices) {
    if (!invoice.saleId) continue;
    if (saleHasCollectibleInvoice(invoice)) {
      saleIdsRepresentedByInvoice.add(invoice.saleId);
    }
  }

  const items: PendingCollectionItem[] = [];

  for (const invoice of invoices) {
    const mapped = mapInvoiceToPendingItem(invoice);
    if (mapped) {
      items.push(mapped);
    }
  }

  for (const sale of sales) {
    if (saleIdsRepresentedByInvoice.has(sale.id)) {
      continue;
    }

    if (saleHasCollectibleInvoice(sale.invoice)) {
      continue;
    }

    const mapped = mapSaleToPendingItem(sale);
    if (mapped) {
      items.push(mapped);
    }
  }

  items.sort(
    (a, b) => b.issueDate.getTime() - a.issueDate.getTime()
  );

  const filtered = filterPendingCollections(items, filters);

  return {
    items: filtered,
    summary: computePendingCollectionsSummary(filtered),
  };
}

export async function getUnpaidInvoiceForSale(
  companyId: string,
  saleId: string
) {
  const invoice = await db.invoice.findFirst({
    where: {
      companyId,
      saleId,
      ...activeInvoiceStatusFilter(),
      status: { not: "DRAFT" },
      paymentStatus: { in: ["UNPAID", "PARTIAL"] },
    },
  });

  if (!invoice || !saleHasCollectibleInvoice(invoice)) {
    return null;
  }

  return invoice;
}
