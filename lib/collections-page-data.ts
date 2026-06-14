import { db } from "@/lib/prisma";
import { getInvoiceCollectionAccounts } from "@/lib/invoice-service";
import { getPendingCollections } from "@/lib/collections-service";
import type { PendingCollectionsFilters } from "@/lib/collections-utils";
import type {
  CollectionDocumentType,
  CollectionDueStatusFilter,
  CollectionPaymentStatusFilter,
} from "@/lib/collections-utils";

export function parseCollectionDocumentType(
  value?: string | null
): CollectionDocumentType | "ALL" {
  if (value === "SALE" || value === "INVOICE") return value;
  return "ALL";
}

export function parseCollectionPaymentStatus(
  value?: string | null
): CollectionPaymentStatusFilter {
  if (value === "UNPAID" || value === "PARTIAL") return value;
  return "ALL";
}

export function parseCollectionDueStatus(
  value?: string | null
): CollectionDueStatusFilter {
  if (value === "OVERDUE" || value === "DUE_TODAY" || value === "UPCOMING") {
    return value;
  }
  return "ALL";
}

export function parseDateParam(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeDateRange(from: Date | null, to: Date | null) {
  if (from && to && from > to) {
    return { from: to, to: from };
  }

  return { from, to };
}

export function buildCollectionsQuery(params: {
  search?: string;
  customerId?: string;
  documentType?: string;
  paymentStatus?: string;
  dueStatus?: string;
  from?: Date | null;
  to?: Date | null;
}) {
  const search = new URLSearchParams();

  if (params.search?.trim()) {
    search.set("q", params.search.trim());
  }

  if (params.customerId) {
    search.set("customerId", params.customerId);
  }

  if (params.documentType && params.documentType !== "ALL") {
    search.set("documentType", params.documentType);
  }

  if (params.paymentStatus && params.paymentStatus !== "ALL") {
    search.set("paymentStatus", params.paymentStatus);
  }

  if (params.dueStatus && params.dueStatus !== "ALL") {
    search.set("dueStatus", params.dueStatus);
  }

  if (params.from) {
    search.set("from", params.from.toISOString().slice(0, 10));
  }

  if (params.to) {
    search.set("to", params.to.toISOString().slice(0, 10));
  }

  const query = search.toString();
  return query ? `/cash-bank/collections?${query}` : "/cash-bank/collections";
}

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
