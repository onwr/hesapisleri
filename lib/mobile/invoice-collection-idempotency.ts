import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { db } from "@/lib/prisma";
import { parseExpenseDate } from "@/lib/expense-utils";
import { collectInvoicePaymentInTransaction } from "@/lib/invoice-service";
import type { CollectInvoiceInput } from "@/lib/invoice-payment-utils";
import {
  isPrismaUniqueConstraintError,
  runTransactionWithRetry,
} from "@/lib/prisma-transaction-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { MobileFinanceError } from "./mobile-finance-errors";

export type CollectionIdempotencyStatus =
  | "COMPLETED"
  | "PROCESSING"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FAILED_RETRYABLE";

export function buildCollectionPayloadHash(payload: {
  invoiceId: string;
  accountId: string;
  amount: number;
  collectedAt?: string;
  note?: string;
}) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

type CollectionResponse = {
  collection: {
    invoiceId: string;
    amount: number;
    paymentStatus: string;
    paidAmount: number;
    remainingAmount: number;
    accountTransactionId?: string;
  };
};

function mapCompletedResult(
  invoiceId: string,
  amount: number,
  data: {
    id: string;
    paymentStatus: string;
    paidAmount: number;
    remainingAmount: number;
    accountTransactionId?: string;
  }
): CollectionResponse {
  return {
    collection: {
      invoiceId: data.id ?? invoiceId,
      amount,
      paymentStatus: data.paymentStatus,
      paidAmount: data.paidAmount,
      remainingAmount: data.remainingAmount,
      accountTransactionId: data.accountTransactionId,
    },
  };
}

async function loadIdempotencyRecord(companyId: string, idempotencyKey: string) {
  return db.invoiceCollectionIdempotency.findUnique({
    where: {
      companyId_idempotencyKey: { companyId, idempotencyKey },
    },
  });
}

export async function getInvoiceCollectionIdempotencyStatus(input: {
  companyId: string;
  idempotencyKey: string;
  payloadHash?: string;
}) {
  const record = await loadIdempotencyRecord(input.companyId, input.idempotencyKey);
  if (!record) {
    return { status: "NOT_FOUND" as const };
  }

  if (input.payloadHash && record.payloadHash !== input.payloadHash) {
    return { status: "CONFLICT" as const };
  }

  if (record.status === "COMPLETED" && record.result) {
    return {
      status: "COMPLETED" as const,
      result: record.result as CollectionResponse,
    };
  }

  if (record.status === "PROCESSING") {
    return { status: "PROCESSING" as const };
  }

  return { status: "FAILED_RETRYABLE" as const };
}

async function claimIdempotencyInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    userId: string;
    idempotencyKey: string;
    payloadHash: string;
    invoiceId: string;
  }
) {
  const existing = await tx.invoiceCollectionIdempotency.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId: input.companyId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  if (existing) {
    if (existing.status === "COMPLETED") {
      if (existing.payloadHash !== input.payloadHash) {
        throw new MobileFinanceError(
          "IDEMPOTENCY_CONFLICT",
          "Aynı idempotency anahtarı farklı işlem verisiyle kullanıldı.",
          409
        );
      }
      if (existing.result) {
        return {
          mode: "replay" as const,
          record: existing,
          result: existing.result as CollectionResponse,
        };
      }
    }

    if (existing.status === "PROCESSING") {
      if (existing.payloadHash !== input.payloadHash) {
        throw new MobileFinanceError(
          "IDEMPOTENCY_CONFLICT",
          "Aynı idempotency anahtarı farklı işlem verisiyle kullanıldı.",
          409
        );
      }
      return { mode: "processing" as const, record: existing };
    }

    const record = await tx.invoiceCollectionIdempotency.update({
      where: { id: existing.id },
      data: {
        status: "PROCESSING",
        payloadHash: input.payloadHash,
        invoiceId: input.invoiceId,
        userId: input.userId,
        result: PrismaNamespace.JsonNull,
        completedAt: null,
      },
    });
    return { mode: "claim" as const, record };
  }

  const record = await tx.invoiceCollectionIdempotency.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      invoiceId: input.invoiceId,
      status: "PROCESSING",
    },
  });
  return { mode: "claim" as const, record };
}

export async function executeIdempotentInvoiceCollection(input: {
  companyId: string;
  userId: string;
  invoiceId: string;
  idempotencyKey: string;
  data: CollectInvoiceInput;
}) {
  const collectedAt = input.data.collectedAt?.trim()
    ? parseExpenseDate(input.data.collectedAt)
    : new Date();

  if (input.data.collectedAt?.trim() && !collectedAt) {
    throw new MobileFinanceError(
      "VALIDATION_ERROR",
      "Geçerli bir tahsilat tarihi girin.",
      400
    );
  }

  const payloadHash = buildCollectionPayloadHash({
    invoiceId: input.invoiceId,
    accountId: input.data.accountId,
    amount: input.data.amount,
    collectedAt: input.data.collectedAt,
    note: input.data.note,
  });

  try {
    const outcome = await runTransactionWithRetry(async (tx) => {
      const claim = await claimIdempotencyInTransaction(tx, {
        companyId: input.companyId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
        invoiceId: input.invoiceId,
      });

      if (claim.mode === "replay") {
        return { replayed: true as const, response: claim.result! };
      }

      if (claim.mode === "processing") {
        return { processing: true as const };
      }

      const collectResult = await collectInvoicePaymentInTransaction(tx, {
        companyId: input.companyId,
        userId: input.userId,
        invoiceId: input.invoiceId,
        data: input.data,
        collectedAt: collectedAt!,
      });

      if (!collectResult.ok) {
        await tx.invoiceCollectionIdempotency.update({
          where: { id: claim.record.id },
          data: { status: "FAILED" },
        });
        return { error: collectResult };
      }

      const response = mapCompletedResult(
        input.invoiceId,
        input.data.amount,
        collectResult.data
      );

      await tx.invoiceCollectionIdempotency.update({
        where: { id: claim.record.id },
        data: {
          status: "COMPLETED",
          accountTransactionId: collectResult.data.accountTransactionId,
          result: response as object,
          completedAt: new Date(),
        },
      });

      return { replayed: false as const, response };
    });

    if ("processing" in outcome && outcome.processing) {
      return {
        status: "PROCESSING" as const,
        idempotencyKey: input.idempotencyKey,
      };
    }

    if ("error" in outcome && outcome.error) {
      const err = outcome.error;
      const code =
        err.status === 404
          ? "INVOICE_NOT_FOUND"
          : err.message.includes("En fazla")
            ? "COLLECTION_AMOUNT_EXCEEDS_REMAINING"
            : "INVALID_COLLECTION_AMOUNT";
      throw new MobileFinanceError(code, err.message, err.status);
    }

    if (!outcome.replayed) {
      invalidateDashboardCache(input.companyId, "invoice-collect");
    }

    return {
      status: "COMPLETED" as const,
      replayed: outcome.replayed,
      ...outcome.response!,
    };
  } catch (error) {
    if (error instanceof MobileFinanceError) {
      throw error;
    }

    if (isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      const existing = await loadIdempotencyRecord(
        input.companyId,
        input.idempotencyKey
      );
      if (existing?.payloadHash !== payloadHash) {
        throw new MobileFinanceError(
          "IDEMPOTENCY_CONFLICT",
          "Aynı idempotency anahtarı farklı işlem verisiyle kullanıldı.",
          409
        );
      }
      if (existing?.status === "COMPLETED" && existing.result) {
        return {
          status: "COMPLETED" as const,
          replayed: true,
          ...(existing.result as CollectionResponse),
        };
      }
      return {
        status: "PROCESSING" as const,
        idempotencyKey: input.idempotencyKey,
      };
    }

    throw error;
  }
}
