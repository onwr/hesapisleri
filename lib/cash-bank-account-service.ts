import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { buildTransferActivityMessage } from "@/lib/activity-log-utils";
import { invalidateDashboardCache } from "@/lib/dashboard-cache-invalidation";
import { getActiveAccountOptions } from "@/lib/account-read-service";
import { runTransactionWithRetry } from "@/lib/prisma-transaction-utils";
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
  reference: string | null;
  balanceAfter: number;
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
  },
  balanceAfter: number
): AccountTransactionDetailRow {
  const amount = Number(transaction.amount);
  const direction = getTransactionDirection(transaction);
  const source = inferTransactionSource(transaction);

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
    reference: extractTransactionReference(transaction.title, transaction.note),
    balanceAfter,
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

  const result = await runTransactionWithRetry(async (tx) => {
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

    if (roundCashMoney(Number(fromAccount.balance)) < amount) {
      return {
        ok: false as const,
        status: 400,
        message: "Kaynak hesapta yetersiz bakiye.",
      };
    }

    const fromBalance = roundCashMoney(Number(fromAccount.balance) - amount);
    const toBalance = roundCashMoney(Number(toAccount.balance) + amount);

    const [outTransaction, inTransaction] = await Promise.all([
      tx.accountTransaction.create({
        data: {
          accountId: fromAccount.id,
          type: "TRANSFER",
          title: `Transfer Çıkışı - ${toAccount.name}`,
          amount,
          date: transferDate,
          note,
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

    return {
      ok: true as const,
      data: {
        outTransaction,
        inTransaction,
        fromBalance,
        toBalance,
        negativeBalanceWarning: fromBalance < 0,
      },
    };
  });

  if (result.ok) {
    invalidateDashboardCache(input.companyId, "account-transfer");
  }

  return result;
}

export async function assertAccountBelongsToCompany(
  companyId: string,
  accountId: string
) {
  const account = await assertAccountOwnership(companyId, accountId);
  return Boolean(account);
}
