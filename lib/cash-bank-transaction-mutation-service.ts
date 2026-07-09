import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import {
  buildFinanceMirrorNote,
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";
import {
  assertCancelReasonProvided,
  assertLifecycleAction,
  LINKED_TRANSACTION_CANCEL_MESSAGE,
  mapAccountTransactionToLifecycle,
  resolveLinkedTransactionSource,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";

type ServiceResult<T> =
  | { ok: true; data: T; replayed?: boolean }
  | { ok: false; status: number; message: string };

type DbClient = Prisma.TransactionClient;

async function loadAccountTransactionForMutation(
  tx: DbClient,
  input: { companyId: string; transactionId: string }
) {
  return tx.accountTransaction.findFirst({
    where: {
      id: input.transactionId,
      account: { companyId: input.companyId },
    },
    include: {
      account: true,
      expense: { select: { id: true } },
      invoice: { select: { id: true } },
      employeePayments: { select: { id: true }, take: 1 },
    },
  });
}

function assertManualTransaction(transaction: {
  expenseId: string | null;
  invoiceId: string | null;
  supplierId: string | null;
  transferGroupId: string | null;
  employeePayments: Array<{ id: string }>;
  title: string;
  note?: string | null;
  type: string;
}) {
  const linked = resolveLinkedTransactionSource({
    expenseId: transaction.expenseId,
    invoiceId: transaction.invoiceId,
    supplierId: transaction.supplierId,
    transferGroupId: transaction.transferGroupId,
    employeePaymentId: transaction.employeePayments[0]?.id ?? null,
    title: transaction.title,
    note: transaction.note,
    type: transaction.type,
  });

  if (linked.linked) {
    return {
      ok: false as const,
      status: 400,
      message: LINKED_TRANSACTION_CANCEL_MESSAGE,
    };
  }

  return { ok: true as const };
}

export async function deleteManualAccountTransaction(input: {
  companyId: string;
  userId: string;
  transactionId: string;
}): Promise<ServiceResult<{ transactionId: string }>> {
  const result = await db.$transaction(async (tx) => {
    const transaction = await loadAccountTransactionForMutation(tx, input);

    if (!transaction) {
      return {
        ok: false as const,
        status: 404,
        message: "Hareket bulunamadı.",
      };
    }

    const manualCheck = assertManualTransaction(transaction);
    if (!manualCheck.ok) {
      return manualCheck;
    }

    if (isFinanceMirrorTransaction(transaction)) {
      return {
        ok: false as const,
        status: 409,
        message: "Ters kayıt hareketleri doğrudan silinemez.",
      };
    }

    const lifecycle = mapAccountTransactionToLifecycle({
      title: transaction.title,
      note: transaction.note,
      isLinked: false,
    });

    try {
      assertLifecycleAction({
        module: "cash_bank",
        state: lifecycle,
        action: "delete",
        message: "Bu hareket silinemez.",
      });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error ? error.message : "Bu hareket silinemez.",
      };
    }

    const amount = roundCashMoney(Number(transaction.amount));
    const currentBalance = roundCashMoney(Number(transaction.account.balance));
    const signed =
      transaction.type === "INCOME" ? -amount : amount;
    const newBalance = roundCashMoney(currentBalance + signed);

    await tx.account.update({
      where: { id: transaction.accountId },
      data: { balance: newBalance },
    });

    await tx.accountTransaction.delete({
      where: { id: transaction.id },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "cash-bank",
      entityType: "ACCOUNT_TRANSACTION",
      entityId: transaction.id,
      action: "DELETE",
      message: `${transaction.account.name} hesabındaki manuel hareket silindi.`,
      relatedTransactionIds: [transaction.id],
    });

    return {
      ok: true as const,
      data: { transactionId: transaction.id },
    };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "cash-bank-manual-transaction");
  }

  return result;
}

export async function reverseManualAccountTransaction(input: {
  companyId: string;
  userId: string;
  transactionId: string;
  reason: string;
}): Promise<ServiceResult<{ reversalTransactionId: string }>> {
  const reason = input.reason?.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "İptal nedeni zorunludur." };
  }

  const result = await db.$transaction(async (tx) => {
    const transaction = await loadAccountTransactionForMutation(tx, input);

    if (!transaction) {
      return {
        ok: false as const,
        status: 404,
        message: "Hareket bulunamadı.",
      };
    }

    const manualCheck = assertManualTransaction(transaction);
    if (!manualCheck.ok) {
      return manualCheck;
    }

    if (isFinanceMirrorTransaction(transaction)) {
      return {
        ok: false as const,
        status: 409,
        message: "Bu hareket zaten iptal edilmiş.",
      };
    }

    const lifecycle = mapAccountTransactionToLifecycle({
      title: transaction.title,
      note: transaction.note,
      isLinked: false,
    });

    try {
      assertLifecycleAction({
        module: "cash_bank",
        state: lifecycle,
        action: "reverse",
      });
      assertCancelReasonProvided({ state: lifecycle, reason });
    } catch (error) {
      return {
        ok: false as const,
        status: 400,
        message:
          error instanceof Error
            ? error.message
            : "Bu hareket ters kayıt ile iptal edilemez.",
      };
    }

    const mirrorExists = await tx.accountTransaction.findFirst({
      where: {
        accountId: transaction.accountId,
        note: { contains: transaction.id },
        type: transaction.type === "INCOME" ? "EXPENSE" : "INCOME",
      },
    });

    if (mirrorExists) {
      return {
        ok: true as const,
        data: { reversalTransactionId: mirrorExists.id },
        replayed: true,
      };
    }

    const amount = roundCashMoney(Number(transaction.amount));
    const reversalType = transaction.type === "INCOME" ? "EXPENSE" : "INCOME";
    const currentBalance = roundCashMoney(Number(transaction.account.balance));
    const newBalance =
      reversalType === "INCOME"
        ? roundCashMoney(currentBalance + amount)
        : roundCashMoney(currentBalance - amount);

    const reversal = await tx.accountTransaction.create({
      data: {
        accountId: transaction.accountId,
        type: reversalType,
        title: `Hareket İptali - ${transaction.title}`,
        amount,
        date: new Date(),
        note: buildFinanceMirrorNote(
          "REVERSAL",
          `${transaction.title} hareketi iptal edildi. Kaynak: ${transaction.id}. Neden: ${reason}`
        ),
      },
    });

    await tx.account.update({
      where: { id: transaction.accountId },
      data: { balance: newBalance },
    });

    await writeLifecycleActivityLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      module: "cash-bank",
      entityType: "ACCOUNT_TRANSACTION",
      entityId: transaction.id,
      action: "REVERSE",
      message: `${transaction.account.name} hesabındaki hareket ters kayıt ile iptal edildi.`,
      reason,
      relatedTransactionIds: [transaction.id, reversal.id],
    });

    return {
      ok: true as const,
      data: { reversalTransactionId: reversal.id },
    };
  });

  if (result.ok && !("replayed" in result && result.replayed)) {
    invalidateDashboardCache(input.companyId, "cash-bank-manual-transaction");
  }

  return result;
}
