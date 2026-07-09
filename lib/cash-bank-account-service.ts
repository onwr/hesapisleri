import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildTransferActivityMessage } from "@/lib/activity-log-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { getActiveAccountOptions } from "@/lib/account-read-service";
import {
  buildFinanceMirrorNote,
  isFinanceMirrorTransaction,
} from "@/lib/finance-reversal-utils";
import {
  assertCancelReasonProvided,
  writeLifecycleActivityLog,
} from "@/lib/transaction-lifecycle-enforcement";
import {
  isPrismaUniqueConstraintError,
  runTransactionWithRetry,
} from "@/lib/prisma-transaction-utils";
import {
  attachRunningBalances,
  computeAccountMetrics,
  extractTransactionReference,
  getTransactionDirection,
  inferTransactionSource,
  parseMovementDate,
  roundCashMoney,
  validateTransferAccounts,
} from "@/lib/cash-bank-account-utils";
import { resolveCashBankTransactionMutationContext } from "@/lib/cash-bank-transaction-row-utils";
import {
  getCompanyAllowNegativeCashBalance,
  hasInsufficientCashBalance,
  INSUFFICIENT_CASH_BALANCE_MESSAGE,
} from "@/lib/cash-balance-policy";

export const manualTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalıdır."),
  amount: z.number().positive("Tutar 0'dan büyük olmalıdır."),
  date: z.string().optional(),
  note: z.string().optional(),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive("Transfer tutarı 0'dan büyük olmalıdır."),
  note: z.string().optional(),
  idempotencyKey: z.string().uuid("Geçerli bir idempotency anahtarı gerekir."),
});

export type ManualTransactionInput = z.infer<typeof manualTransactionSchema>;
export type TransferInput = z.infer<typeof transferSchema>;

/** Kaynak/hedef hesapları company scope ile deterministik sırada kilitle. */
async function lockCompanyAccountsForUpdate(
  tx: Prisma.TransactionClient,
  companyId: string,
  accountIdA: string,
  accountIdB: string,
) {
  const orderedIds = [accountIdA, accountIdB].sort((a, b) => a.localeCompare(b));

  for (const accountId of orderedIds) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Account"
      WHERE id = ${accountId} AND "companyId" = ${companyId}
      FOR UPDATE
    `;
    if (rows.length === 0) {
      return false;
    }
  }

  return true;
}

export type AccountTransactionDetailRow = {
  id: string;
  date: Date;
  createdAt: Date;
  title: string;
  note: string | null;
  amount: number;
  type: string;
  direction: "in" | "out";
  directionLabel: string;
  sourceLabel: string;
  sourceKey: string;
  reference: string | null;
  balanceAfter: number;
  expenseId?: string | null;
  invoiceId?: string | null;
  supplierId?: string | null;
  transferGroupId?: string | null;
  isLinked: boolean;
  isMirror: boolean;
  isTransfer: boolean;
  linkedHref?: string;
  lifecycleActions: import("@/lib/transaction-lifecycle-policy").LifecycleActionMatrix;
};

export type SerializedAccount = {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  iban: string | null;
  balance: number;
  currency: string;
  status: string;
  isDefault: boolean;
};

function mapTransactionRow(
  transaction: {
    id: string;
    date: Date;
    createdAt: Date;
    title: string;
    note: string | null;
    amount: unknown;
    type: string;
    expenseId?: string | null;
    invoiceId?: string | null;
    supplierId?: string | null;
    transferGroupId?: string | null;
  },
  balanceAfter: number
): AccountTransactionDetailRow {
  const amount = Number(transaction.amount);
  const direction = getTransactionDirection(transaction);
  const source = inferTransactionSource(transaction);
  const mutation = resolveCashBankTransactionMutationContext(transaction);

  return {
    id: transaction.id,
    date: transaction.date,
    createdAt: transaction.createdAt,
    title: transaction.title,
    note: transaction.note,
    amount,
    type: transaction.type,
    direction,
    directionLabel: direction === "in" ? "Giriş" : "Çıkış",
    sourceLabel: source.label,
    sourceKey: source.key,
    reference: extractTransactionReference(transaction.title, transaction.note),
    balanceAfter,
    expenseId: transaction.expenseId,
    invoiceId: transaction.invoiceId,
    supplierId: transaction.supplierId,
    transferGroupId: transaction.transferGroupId,
    isLinked: mutation.isLinked,
    isMirror: mutation.isMirror,
    isTransfer: mutation.isTransfer,
    linkedHref: mutation.linkedHref,
    lifecycleActions: mutation.lifecycleActions,
  };
}

export async function getCompanyAccounts(companyId: string) {
  return getActiveAccountOptions(companyId);
}

export async function getAccountDetailData(companyId: string, accountId: string) {
  const [account, companyAccounts] = await Promise.all([
    db.account.findFirst({
      where: { id: accountId, companyId },
      include: {
        transactions: {
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        },
      },
    }),
    getCompanyAccounts(companyId),
  ]);

  if (!account) {
    return null;
  }

  const currentBalance = Number(account.balance);
  const rawTransactions = account.transactions.map((transaction) => ({
    id: transaction.id,
    date: transaction.date,
    createdAt: transaction.createdAt,
    title: transaction.title,
    note: transaction.note,
    amount: Number(transaction.amount),
    type: transaction.type,
    expenseId: transaction.expenseId,
    invoiceId: transaction.invoiceId,
    supplierId: transaction.supplierId,
    transferGroupId: transaction.transferGroupId,
  }));

  const withBalances = attachRunningBalances(rawTransactions, currentBalance);
  const transactions = withBalances.map((transaction) =>
    mapTransactionRow(transaction, transaction.balanceAfter)
  );
  const metrics = computeAccountMetrics(rawTransactions, currentBalance);

  return {
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
      bankName: account.bankName,
      iban: account.iban,
      balance: currentBalance,
      currency: account.currency,
      status: account.status,
      isDefault: account.isDefault,
    } satisfies SerializedAccount,
    transactions,
    metrics,
    companyAccounts,
  };
}

export async function getAccountExportData(companyId: string, accountId: string) {
  const detail = await getAccountDetailData(companyId, accountId);
  if (!detail) {
    return null;
  }

  return {
    accountName: detail.account.name,
    transactions: detail.transactions,
  };
}

async function assertAccountOwnership(
  companyId: string,
  accountId: string
) {
  return db.account.findFirst({
    where: {
      id: accountId,
      companyId,
    },
  });
}

export async function applyManualAccountTransaction(input: {
  companyId: string;
  userId: string;
  accountId: string;
  data: ManualTransactionInput;
}) {
  const movementDate = parseMovementDate(input.data.date);
  if (!movementDate) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir işlem tarihi girin.",
    };
  }

  const amount = roundCashMoney(input.data.amount);
  const note = input.data.note?.trim() || null;
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  const result = await db.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: {
        id: input.accountId,
        companyId: input.companyId,
      },
    });

    if (!account) {
      return {
        ok: false as const,
        status: 404,
        message: "Hesap bulunamadı.",
      };
    }

    if (
      input.data.type === "EXPENSE" &&
      hasInsufficientCashBalance(
        account.balance,
        amount,
        allowNegativeCashBalance
      )
    ) {
      return {
        ok: false as const,
        status: 400,
        message: INSUFFICIENT_CASH_BALANCE_MESSAGE,
      };
    }

    const currentBalance = Number(account.balance);
    const newBalance =
      input.data.type === "INCOME"
        ? roundCashMoney(currentBalance + amount)
        : roundCashMoney(currentBalance - amount);

    const transaction = await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        type: input.data.type,
        title: input.data.title.trim(),
        amount,
        date: movementDate,
        note,
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: { balance: newBalance },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "cash-bank",
        message: `${account.name} hesabına manuel ${input.data.type === "INCOME" ? "giriş" : "çıkış"} kaydedildi (${amount} TRY).`,
      },
    });

    return {
      ok: true as const,
      data: {
        transaction,
        newBalance,
        negativeBalanceWarning: newBalance < 0,
      },
    };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "cash-bank-manual-transaction");
  }

  return result;
}

function hashTransferPayload(input: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string | null;
}) {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
}

export async function applyAccountTransfer(input: {
  companyId: string;
  userId: string;
  data: TransferInput;
}) {
  const validationError = validateTransferAccounts(
    input.data.fromAccountId,
    input.data.toAccountId,
    input.data.amount
  );

  if (validationError) {
    return {
      ok: false as const,
      status: 400,
      message: validationError,
    };
  }

  const amount = roundCashMoney(input.data.amount);
  const note = input.data.note?.trim() || null;
  const transferDate = new Date();
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  const payloadHash = hashTransferPayload({
    fromAccountId: input.data.fromAccountId,
    toAccountId: input.data.toAccountId,
    amount,
    note,
  });

  try {
    const result = await runTransactionWithRetry(async (tx) => {
      // İdempotency claim — aynı transaction içinde. Aynı key + aynı payload
      // → tamamlanmış sonucu replay eder. Aynı key + farklı payload → hata.
      const existing = await tx.accountTransferIdempotency.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey: input.data.idempotencyKey,
          },
        },
      });

      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          return {
            ok: false as const,
            status: 409,
            message: "Aynı işlem anahtarı farklı transfer verisiyle kullanıldı.",
          };
        }
        if (existing.status === "COMPLETED" && existing.result) {
          return {
            ok: true as const,
            replayed: true,
            data: existing.result as unknown as {
              fromBalance: number;
              toBalance: number;
              negativeBalanceWarning: boolean;
              transferGroupId: string;
            },
          };
        }
        // PROCESSING durumunda (nadir yarış durumu) — güvenli, açık hata.
        return {
          ok: false as const,
          status: 409,
          message: "Transfer işleniyor, lütfen kısa süre sonra tekrar deneyin.",
        };
      }

      const claim = await tx.accountTransferIdempotency.create({
        data: {
          companyId: input.companyId,
          idempotencyKey: input.data.idempotencyKey,
          payloadHash,
          status: "PROCESSING",
        },
      });

      const locked = await lockCompanyAccountsForUpdate(
        tx,
        input.companyId,
        input.data.fromAccountId,
        input.data.toAccountId,
      );

      if (!locked) {
        return {
          ok: false as const,
          status: 404,
          message: "Hesap bulunamadı.",
        };
      }

      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findFirst({
          where: {
            id: input.data.fromAccountId,
            companyId: input.companyId,
          },
        }),
        tx.account.findFirst({
          where: {
            id: input.data.toAccountId,
            companyId: input.companyId,
          },
        }),
      ]);

      if (!fromAccount || !toAccount) {
        return {
          ok: false as const,
          status: 404,
          message: "Hesap bulunamadı.",
        };
      }

      if (fromAccount.currency !== toAccount.currency) {
        return {
          ok: false as const,
          status: 400,
          message:
            "Farklı para birimine sahip hesaplar arası doğrudan transfer desteklenmiyor. Hesapların para birimleri eşleşmelidir.",
        };
      }

      if (
        hasInsufficientCashBalance(
          fromAccount.balance,
          amount,
          allowNegativeCashBalance
        )
      ) {
        return {
          ok: false as const,
          status: 400,
          message: "Kaynak hesapta yetersiz bakiye.",
        };
      }

      const fromBalance = roundCashMoney(Number(fromAccount.balance) - amount);
      const toBalance = roundCashMoney(Number(toAccount.balance) + amount);
      const transferGroupId = randomUUID();

      const [outTransaction, inTransaction] = await Promise.all([
        tx.accountTransaction.create({
          data: {
            accountId: fromAccount.id,
            type: "TRANSFER",
            title: `Transfer Çıkışı - ${toAccount.name}`,
            amount,
            date: transferDate,
            note,
            transferGroupId,
          },
        }),
        tx.accountTransaction.create({
          data: {
            accountId: toAccount.id,
            type: "TRANSFER",
            title: `Transfer Girişi - ${fromAccount.name}`,
            amount,
            date: transferDate,
            note,
            transferGroupId,
          },
        }),
      ]);

      await Promise.all([
        tx.account.update({
          where: { id: fromAccount.id },
          data: { balance: fromBalance },
        }),
        tx.account.update({
          where: { id: toAccount.id },
          data: { balance: toBalance },
        }),
      ]);

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "TRANSFER",
          module: "cash-bank",
          message: buildTransferActivityMessage(
            fromAccount.name,
            toAccount.name,
            amount
          ),
        },
      });

      const resultData = {
        fromBalance,
        toBalance,
        negativeBalanceWarning: fromBalance < 0,
        transferGroupId,
      };

      await tx.accountTransferIdempotency.update({
        where: { id: claim.id },
        data: {
          status: "COMPLETED",
          transferGroupId,
          result: resultData,
          completedAt: new Date(),
        },
      });

      return {
        ok: true as const,
        replayed: false,
        data: {
          ...resultData,
          outTransaction,
          inTransaction,
        },
      };
    });

    if (result.ok) {
      invalidateDashboardCache(input.companyId, "account-transfer");
    }

    return result;
  } catch (error) {
    if (isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      // Eşzamanlı iki istek aynı key ile yarıştı — ikinci istek burada yakalanır.
      const existing = await db.accountTransferIdempotency.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey: input.data.idempotencyKey,
          },
        },
      });
      if (existing?.payloadHash !== payloadHash) {
        return {
          ok: false as const,
          status: 409,
          message: "Aynı işlem anahtarı farklı transfer verisiyle kullanıldı.",
        };
      }
      if (existing?.status === "COMPLETED" && existing.result) {
        return {
          ok: true as const,
          replayed: true,
          data: existing.result as unknown as {
            fromBalance: number;
            toBalance: number;
            negativeBalanceWarning: boolean;
            transferGroupId: string;
          },
        };
      }
      return {
        ok: false as const,
        status: 409,
        message: "Transfer işleniyor, lütfen kısa süre sonra tekrar deneyin.",
      };
    }

    throw error;
  }
}

export async function assertAccountBelongsToCompany(
  companyId: string,
  accountId: string
) {
  const account = await assertAccountOwnership(companyId, accountId);
  return Boolean(account);
}

function hashCancelTransferPayload(transferGroupId: string, reason: string) {
  return createHash("sha256")
    .update(JSON.stringify({ transferGroupId, reason }))
    .digest("hex");
}

export async function cancelAccountTransfer(input: {
  companyId: string;
  userId: string;
  transferGroupId: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<
  | {
      ok: true;
      data: {
        transferGroupId: string;
        reversalGroupId: string;
        outReversalId: string;
        inReversalId: string;
      };
      replayed?: boolean;
    }
  | { ok: false; status: number; message: string }
> {
  const reason = input.reason?.trim();
  if (!reason) {
    return { ok: false, status: 400, message: "İptal nedeni zorunludur." };
  }

  const idempotencyKey =
    input.idempotencyKey ?? `cancel-transfer:${input.transferGroupId}`;

  try {
    const result = await runTransactionWithRetry(async (tx) => {
      const legs = await tx.accountTransaction.findMany({
        where: {
          transferGroupId: input.transferGroupId,
          account: { companyId: input.companyId },
        },
        include: { account: true },
        orderBy: { createdAt: "asc" },
      });

      if (legs.length !== 2) {
        return {
          ok: false as const,
          status: 404,
          message: "Transfer kaydı bulunamadı.",
        };
      }

      if (legs.some((leg) => isFinanceMirrorTransaction(leg))) {
        return {
          ok: false as const,
          status: 409,
          message: "Bu transfer zaten iptal edilmiş.",
        };
      }

      const payloadHash = hashCancelTransferPayload(
        input.transferGroupId,
        reason
      );

      const existing = await tx.accountTransferIdempotency.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey,
          },
        },
      });

      if (existing?.status === "COMPLETED" && existing.result) {
        return {
          ok: true as const,
          replayed: true,
          data: existing.result as {
            transferGroupId: string;
            reversalGroupId: string;
            outReversalId: string;
            inReversalId: string;
          },
        };
      }

      const mirrorExists = await tx.accountTransaction.findFirst({
        where: {
          note: { contains: input.transferGroupId },
          account: { companyId: input.companyId },
        },
      });

      if (mirrorExists) {
        const mirrors = await tx.accountTransaction.findMany({
          where: {
            transferGroupId: mirrorExists.transferGroupId ?? undefined,
            account: { companyId: input.companyId },
          },
        });

        if (mirrors.length === 2) {
          return {
            ok: true as const,
            replayed: true,
            data: {
              transferGroupId: input.transferGroupId,
              reversalGroupId: mirrorExists.transferGroupId!,
              outReversalId: mirrors[0]!.id,
              inReversalId: mirrors[1]!.id,
            },
          };
        }
      }

      assertCancelReasonProvided({ state: "COMPLETED", reason });

      const outLeg = legs.find((leg) => leg.type === "TRANSFER" && leg.title.includes("Çıkış"))
        ?? legs[0]!;
      const inLeg = legs.find((leg) => leg.id !== outLeg.id)!;

      if (outLeg.account.currency !== inLeg.account.currency) {
        return {
          ok: false as const,
          status: 400,
          message: "Transfer hesaplarının para birimleri eşleşmiyor.",
        };
      }

      const amount = roundCashMoney(Number(outLeg.amount));
      const reversalGroupId = randomUUID();

      const locked = await lockCompanyAccountsForUpdate(
        tx,
        input.companyId,
        outLeg.accountId,
        inLeg.accountId
      );

      if (!locked) {
        return {
          ok: false as const,
          status: 404,
          message: "Hesap bulunamadı.",
        };
      }

      const [fromAccount, toAccount] = await Promise.all([
        tx.account.findFirst({ where: { id: outLeg.accountId } }),
        tx.account.findFirst({ where: { id: inLeg.accountId } }),
      ]);

      if (!fromAccount || !toAccount) {
        return {
          ok: false as const,
          status: 404,
          message: "Hesap bulunamadı.",
        };
      }

      const outReversal = await tx.accountTransaction.create({
        data: {
          accountId: outLeg.accountId,
          type: "INCOME",
          title: `Transfer İptali - ${toAccount.name}`,
          amount,
          date: new Date(),
          transferGroupId: reversalGroupId,
          note: buildFinanceMirrorNote(
            "REVERSAL",
            `Transfer iptal edildi. Kaynak grup: ${input.transferGroupId}. Neden: ${reason}`
          ),
        },
      });

      const inReversal = await tx.accountTransaction.create({
        data: {
          accountId: inLeg.accountId,
          type: "EXPENSE",
          title: `Transfer İptali - ${fromAccount.name}`,
          amount,
          date: new Date(),
          transferGroupId: reversalGroupId,
          note: buildFinanceMirrorNote(
            "REVERSAL",
            `Transfer iptal edildi. Kaynak grup: ${input.transferGroupId}. Neden: ${reason}`
          ),
        },
      });

      await Promise.all([
        tx.account.update({
          where: { id: outLeg.accountId },
          data: {
            balance: roundCashMoney(Number(fromAccount.balance) + amount),
          },
        }),
        tx.account.update({
          where: { id: inLeg.accountId },
          data: {
            balance: roundCashMoney(Number(toAccount.balance) - amount),
          },
        }),
      ]);

      await writeLifecycleActivityLog(tx, {
        companyId: input.companyId,
        userId: input.userId,
        module: "cash-bank",
        entityType: "ACCOUNT_TRANSFER",
        entityId: input.transferGroupId,
        action: "CANCEL",
        message: `${fromAccount.name} → ${toAccount.name} transferi iptal edildi.`,
        reason,
        relatedTransactionIds: [
          outLeg.id,
          inLeg.id,
          outReversal.id,
          inReversal.id,
        ],
      });

      const resultData = {
        transferGroupId: input.transferGroupId,
        reversalGroupId,
        outReversalId: outReversal.id,
        inReversalId: inReversal.id,
      };

      await tx.accountTransferIdempotency.upsert({
        where: {
          companyId_idempotencyKey: {
            companyId: input.companyId,
            idempotencyKey,
          },
        },
        create: {
          companyId: input.companyId,
          idempotencyKey,
          payloadHash,
          status: "COMPLETED",
          transferGroupId: reversalGroupId,
          result: resultData,
          completedAt: new Date(),
        },
        update: {
          status: "COMPLETED",
          transferGroupId: reversalGroupId,
          result: resultData,
          completedAt: new Date(),
        },
      });

      return {
        ok: true as const,
        data: resultData,
      };
    });

    if (result.ok && !result.replayed) {
      invalidateDashboardCache(input.companyId, "account-transfer");
    }

    return result;
  } catch (error) {
    if (isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      return {
        ok: false,
        status: 409,
        message: "Transfer iptali işleniyor, lütfen kısa süre sonra tekrar deneyin.",
      };
    }

    throw error;
  }
}
