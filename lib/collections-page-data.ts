import { db } from "@/lib/prisma";
import { getInvoiceCollectionAccounts } from "@/lib/invoice-service";
import { getPendingCollections } from "@/lib/collections-service";
import type { PendingCollectionsFilters } from "@/lib/collections-utils";
import {
  normalizeDateRange,
  parseCollectionDocumentType,
  parseCollectionDueStatus,
  parseCollectionPaymentStatus,
  parseDateParam,
} from "@/lib/collections-page-utils";

export async function getCollectionsPageData(
  companyId: string,
  params: {
    search?: string;
    customerId?: string;
    documentType?: string;
    paymentStatus?: string;
    dueStatus?: string;
    from?: string;
    to?: string;
  }
) {
  const { from, to } = normalizeDateRange(
    parseDateParam(params.from),
    parseDateParam(params.to)
  );

  const filters: PendingCollectionsFilters = {
    search: params.search,
    customerId: params.customerId,
    documentType: parseCollectionDocumentType(params.documentType),
    paymentStatus: parseCollectionPaymentStatus(params.paymentStatus),
    dueStatus: parseCollectionDueStatus(params.dueStatus),
    from,
    to,
  };

  const [{ items, summary }, accounts, customers] = await Promise.all([
    getPendingCollections(companyId, filters),
    getInvoiceCollectionAccounts(companyId),
    db.customer.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return {
    items,
    summary,
    accounts,
    customers,
    filters,
  };
}
