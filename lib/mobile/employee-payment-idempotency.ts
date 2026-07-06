import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createEmployeePayment, EmployeeServiceError } from "@/lib/employee-service";
import {
  isPrismaUniqueConstraintError,
  runTransactionWithRetry,
} from "@/lib/prisma-transaction-utils";
import { MobileFinanceError } from "./mobile-finance-errors";

/**
 * Kalıcı (DB-backed) çalışan ödemesi idempotency yürütücüsü —
 * invoice-collection-idempotency.ts ile aynı desen. In-memory Map artık
 * güvenlik kaynağı DEĞİL; bu modül process restart / PM2 cluster / eşzamanlı
 * request senaryolarında da tek ödeme garantisi verir (companyId+idempotencyKey
 * @@unique kısıtı).
 */

export type EmployeePaymentInput = {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  type: string;
  amount: number;
  relatedAccountId: string;
  dueDate?: Date;
  description?: string;
};

export function buildEmployeePaymentPayloadHash(payload: {
  employeeId: string;
  type: string;
  amount: number;
  accountId: string;
  dueDate?: string;
  description?: string;
}) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function loadIdempotencyRecord(companyId: string, idempotencyKey: string) {
  return db.employeePaymentIdempotency.findUnique({
    where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
  });
}

async function claimIdempotencyInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    employeeId: string;
    userId: string;
    idempotencyKey: string;
    payloadHash: string;
  }
) {
  const existing = await tx.employeePaymentIdempotency.findUnique({
    where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
  });

  if (existing) {
    if (existing.payloadHash !== input.payloadHash) {
      throw new MobileFinanceError(
        "IDEMPOTENCY_CONFLICT",
        "Aynı idempotency anahtarı farklı ödeme verisiyle kullanıldı.",
        409
      );
    }

    if (existing.status === "COMPLETED" && existing.result) {
      return { mode: "replay" as const, record: existing };
    }

    if (existing.status === "PROCESSING") {
      return { mode: "processing" as const, record: existing };
    }

    const record = await tx.employeePaymentIdempotency.update({
      where: { id: existing.id },
      data: {
        status: "PROCESSING",
        payloadHash: input.payloadHash,
        employeeId: input.employeeId,
        userId: input.userId,
        result: PrismaNamespace.JsonNull,
        completedAt: null,
      },
    });
    return { mode: "claim" as const, record };
  }

  const record = await tx.employeePaymentIdempotency.create({
    data: {
      companyId: input.companyId,
      employeeId: input.employeeId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      payloadHash: input.payloadHash,
      status: "PROCESSING",
    },
  });
  return { mode: "claim" as const, record };
}

export async function executeIdempotentEmployeePayment(input: {
  companyId: string;
  actorUserId: string;
  employeeId: string;
  idempotencyKey: string;
  payment: EmployeePaymentInput;
  serialize: (payment: unknown) => unknown;
}) {
  const payloadHash = buildEmployeePaymentPayloadHash({
    employeeId: input.employeeId,
    type: input.payment.type,
    amount: input.payment.amount,
    accountId: input.payment.relatedAccountId,
    dueDate: input.payment.dueDate?.toISOString(),
    description: input.payment.description,
  });

  try {
    const outcome = await runTransactionWithRetry(async (tx) => {
      const claim = await claimIdempotencyInTransaction(tx, {
        companyId: input.companyId,
        employeeId: input.employeeId,
        userId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      });

      if (claim.mode === "replay") {
        return { replayed: true as const, result: claim.record.result as object };
      }

      if (claim.mode === "processing") {
        return { processing: true as const };
      }

      const created = await createEmployeePayment({
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        employeeId: input.employeeId,
        type: input.payment.type as never,
        amount: input.payment.amount,
        relatedAccountId: input.payment.relatedAccountId,
        dueDate: input.payment.dueDate,
        description: input.payment.description,
        payImmediately: true,
        tx,
      });

      const serialized = input.serialize(created) as object;

      await tx.employeePaymentIdempotency.update({
        where: { id: claim.record.id },
        data: {
          status: "COMPLETED",
          paymentId: (created as { id: string }).id,
          result: serialized,
          completedAt: new Date(),
        },
      });

      return { replayed: false as const, result: serialized };
    });

    if ("processing" in outcome && outcome.processing) {
      return { status: "PROCESSING" as const };
    }

    return {
      status: "COMPLETED" as const,
      replayed: outcome.replayed,
      result: outcome.result!,
    };
  } catch (error) {
    if (error instanceof MobileFinanceError) {
      throw error;
    }

    if (isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      const existing = await loadIdempotencyRecord(input.companyId, input.idempotencyKey);
      if (existing?.payloadHash !== payloadHash) {
        throw new MobileFinanceError(
          "IDEMPOTENCY_CONFLICT",
          "Aynı idempotency anahtarı farklı ödeme verisiyle kullanıldı.",
          409
        );
      }
      if (existing?.status === "COMPLETED" && existing.result) {
        return { status: "COMPLETED" as const, replayed: true, result: existing.result as object };
      }
      return { status: "PROCESSING" as const };
    }

    if (error instanceof EmployeeServiceError) {
      throw new MobileFinanceError("EMPLOYEE_PAYMENT_FAILED", error.message, error.status);
    }

    throw error;
  }
}
