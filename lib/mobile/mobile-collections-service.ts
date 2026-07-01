import { z } from "zod";
import { getPendingCollections } from "@/lib/collections-service";
import { collectInvoiceSchema } from "@/lib/invoice-payment-utils";
import { db } from "@/lib/prisma";
import { MobileFinanceError } from "./mobile-finance-errors";
import { resolveMobileFinancePermissions } from "./mobile-finance-permissions";
import {
  executeIdempotentInvoiceCollection,
  getInvoiceCollectionIdempotencyStatus,
} from "./invoice-collection-idempotency";

const PAGE_SIZE = 24;

export const mobileCollectionSchema = collectInvoiceSchema.extend({
  invoiceId: z.string().min(1, "Fatura seçilmelidir."),
  idempotencyKey: z.string().uuid("Geçerli idempotency anahtarı gerekir."),
});

export async function listMobilePendingCollections(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  q?: string;
  customerId?: string;
  dueStatus?: string;
  overdue?: boolean;
  cursor?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.collections.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tahsilat görüntüleme yetkiniz yok.", 403);
  }

  const dueStatus =
    input.overdue || input.dueStatus === "OVERDUE"
      ? ("OVERDUE" as const)
      : input.dueStatus === "UPCOMING"
        ? ("UPCOMING" as const)
        : input.dueStatus === "DUE_TODAY"
          ? ("DUE_TODAY" as const)
          : undefined;

  const { items, summary } = await getPendingCollections(input.companyId, {
    search: input.q,
    customerId: input.customerId,
    documentType: "INVOICE",
    dueStatus: dueStatus ?? "ALL",
  });

  const invoiceItems = items.filter((i) => i.documentType === "INVOICE");
  const start = input.cursor
    ? invoiceItems.findIndex((i) => i.documentId === input.cursor) + 1
    : 0;
  const slice = invoiceItems.slice(start, start + PAGE_SIZE + 1);
  const hasMore = slice.length > PAGE_SIZE;
  const page = hasMore ? slice.slice(0, PAGE_SIZE) : slice;

  return {
    permissions,
    items: page.map((item) => ({
      id: item.documentId,
      invoiceNumber: item.documentNo,
      customer: item.customerId
        ? { id: item.customerId, name: item.customerName }
        : null,
      dueDate: item.dueDate?.toISOString() ?? null,
      issueDate: item.issueDate.toISOString(),
      total: item.totalAmount,
      paidAmount: item.paidAmount,
      remainingAmount: item.remainingAmount,
      overdue: item.isOverdue,
      overdueDays: item.isOverdue && item.dueDate
        ? Math.max(0, Math.floor((Date.now() - item.dueDate.getTime()) / 86400000))
        : 0,
      paymentStatus: item.paymentStatus,
    })),
    summary: {
      pendingCount: summary.pendingCount,
      pendingTotal: summary.pendingTotal,
      overdueCount: summary.overdueCount,
    },
    nextCursor: hasMore ? page[page.length - 1]?.documentId ?? null : null,
  };
}

export async function createMobileCollection(input: {
  companyId: string;
  userId: string;
  role: string;
  isOwner: boolean;
  body: unknown;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.collections.create) {
    throw new MobileFinanceError("FORBIDDEN", "Tahsilat yetkiniz yok.", 403);
  }

  const parsed = mobileCollectionSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Bilgileri kontrol edin.",
      400,
      parsed.error.flatten().fieldErrors as Record<string, string[]>
    );
  }

  const { invoiceId, idempotencyKey, ...collectData } = parsed.data;

  const account = await db.account.findFirst({
    where: { id: collectData.accountId, companyId: input.companyId },
  });
  if (!account) {
    throw new MobileFinanceError("COLLECTION_ACCOUNT_NOT_FOUND", "Ödeme hesabı bulunamadı.", 404);
  }

  const result = await executeIdempotentInvoiceCollection({
    companyId: input.companyId,
    userId: input.userId,
    invoiceId,
    idempotencyKey,
    data: collectData,
  });

  if (result.status === "PROCESSING") {
    return {
      status: "PROCESSING" as const,
      idempotencyKey: result.idempotencyKey,
      message: "İşlem devam ediyor. Durumu kontrol edin.",
    };
  }

  const { replayed, collection } = result;
  return {
    status: "COMPLETED" as const,
    replayed,
    collection,
  };
}

export async function getMobileCollectionStatus(input: {
  companyId: string;
  role: string;
  isOwner: boolean;
  idempotencyKey: string;
  payloadHash?: string;
}) {
  const permissions = resolveMobileFinancePermissions(input.role, input.isOwner);
  if (!permissions.collections.read) {
    throw new MobileFinanceError("FORBIDDEN", "Tahsilat görüntüleme yetkiniz yok.", 403);
  }

  return getInvoiceCollectionIdempotencyStatus({
    companyId: input.companyId,
    idempotencyKey: input.idempotencyKey,
    payloadHash: input.payloadHash,
  });
}
