import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-transaction-utils";
import {
  adjustmentBalanceEffect,
  collectionBalanceEffect,
  paymentBalanceEffect,
  resolveSupplierBalanceView,
} from "@/lib/supplier-balance-utils";
import { syncSupplierBalance } from "@/lib/supplier-balance-service";
import {
  describeOverpaymentNotice,
  parseSupplierFinanceAmount,
  validateSupplierCollectionAmount,
  validateSupplierFinanceAccount,
} from "@/lib/supplier-payment-validation";
import { getSupplierDisplayName } from "@/lib/supplier-utils";

export class SupplierFinanceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SupplierFinanceError";
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

async function assertSupplierInCompany(tx: Tx, companyId: string, supplierId: string) {
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, companyId },
  });

  if (!supplier) {
    throw new SupplierFinanceError("Tedarikçi bulunamadı.", 404);
  }

  return supplier;
}

async function loadIdempotentLedgerEntry(
  tx: Tx,
  companyId: string,
  idempotencyKey: string
) {
  return tx.supplierLedgerEntry.findUnique({
    where: {
      companyId_idempotencyKey: { companyId, idempotencyKey },
    },
    include: {
      accountTransaction: {
        include: { account: { select: { id: true, name: true } } },
      },
    },
  });
}

function assertIdempotentPaymentMatch(
  existing: {
    supplierId: string;
    amount: unknown;
    type: string;
    accountTransaction: { accountId: string } | null;
  },
  input: {
    supplierId: string;
    amount: number;
    accountId: string;
  }
) {
  if (
    existing.supplierId !== input.supplierId ||
    existing.type !== "PAYMENT" ||
    roundCashMoney(Number(existing.amount)) !== roundCashMoney(input.amount) ||
    existing.accountTransaction?.accountId !== input.accountId
  ) {
    throw new SupplierFinanceError(
      "Aynı idempotency anahtarı farklı ödeme verisiyle kullanılamaz.",
      409
    );
  }
}

function assertIdempotentCollectionMatch(
  existing: {
    supplierId: string;
    amount: unknown;
    type: string;
    accountTransaction: { accountId: string } | null;
  },
  input: {
    supplierId: string;
    amount: number;
    accountId: string;
  }
) {
  if (
    existing.supplierId !== input.supplierId ||
    existing.type !== "COLLECTION" ||
    roundCashMoney(Number(existing.amount)) !== roundCashMoney(input.amount) ||
    existing.accountTransaction?.accountId !== input.accountId
  ) {
    throw new SupplierFinanceError(
      "Aynı idempotency anahtarı farklı tahsilat verisiyle kullanılamaz.",
      409
    );
  }
}

export async function createSupplierOpeningLedgerEntry(input: {
  tx: Tx;
  companyId: string;
  supplierId: string;
  userId: string;
  signedOpeningBalance: number;
  date: Date;
  description?: string | null;
}) {
  if (input.signedOpeningBalance === 0) return null;

  const amount = Math.abs(input.signedOpeningBalance);
  const balanceEffect = roundCashMoney(input.signedOpeningBalance);

  return input.tx.supplierLedgerEntry.create({
    data: {
      companyId: input.companyId,
      supplierId: input.supplierId,
      type: "OPENING_BALANCE",
      amount,
      balanceEffect,
      date: input.date,
      description: input.description?.trim() || "Açılış bakiyesi",
      sourceType: "OPENING_BALANCE",
      sourceId: input.supplierId,
      createdByUserId: input.userId,
    },
  });
}

export async function createSupplierPayment(input: {
  companyId: string;
  supplierId: string;
  userId: string;
  accountId: string;
  amount: number;
  date?: Date;
  description?: string;
  expenseId?: string | null;
  idempotencyKey?: string;
}) {
  const amountParsed = parseSupplierFinanceAmount(input.amount);
  if (!amountParsed.ok) {
    throw new SupplierFinanceError(amountParsed.message);
  }

  const paymentDate = input.date ?? new Date();

  try {
    const result = await db.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await loadIdempotentLedgerEntry(
          tx,
          input.companyId,
          input.idempotencyKey
        );
        if (existing) {
          assertIdempotentPaymentMatch(existing, {
            supplierId: input.supplierId,
            amount: amountParsed.amount,
            accountId: input.accountId,
          });
          return { ledgerEntry: existing, replay: true as const, overpaymentNotice: null };
        }
      }

      const supplier = await assertSupplierInCompany(tx, input.companyId, input.supplierId);

      if (input.expenseId) {
        const expense = await tx.expense.findFirst({
          where: {
            id: input.expenseId,
            companyId: input.companyId,
            supplierId: input.supplierId,
          },
          include: { accountTransaction: true },
        });
        if (!expense) {
          throw new SupplierFinanceError("İlişkili gider bulunamadı.", 404);
        }
        if (expense.paymentStatus === "PAID" || expense.accountTransaction) {
          throw new SupplierFinanceError("Bu gider zaten ödenmiş.");
        }
      }

      const accountRecord = await tx.account.findFirst({
        where: { id: input.accountId },
      });

      const accountValidation = validateSupplierFinanceAccount(
        accountRecord,
        input.companyId,
        {
          paymentCurrency: supplier.currency,
          amount: amountParsed.amount,
          checkBalance: true,
          purpose: "disbursement",
        }
      );

      if (!accountValidation.ok) {
        throw new SupplierFinanceError(accountValidation.message);
      }

      const account = accountValidation.account;
      const beforeView = resolveSupplierBalanceView(Number(supplier.currentBalance));
      const overpaymentNotice = describeOverpaymentNotice(
        amountParsed.amount,
        beforeView.payableAmount
      );

      const transaction = await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          supplierId: input.supplierId,
          type: "PAYMENT",
          title: input.expenseId
            ? `${getSupplierDisplayName(supplier)} gider ödemesi`
            : `${getSupplierDisplayName(supplier)} ödemesi`,
          amount: amountParsed.amount,
          date: paymentDate,
          note: input.description?.trim() || null,
          expenseId: input.expenseId ?? undefined,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: roundCashMoney(Number(account.balance) - amountParsed.amount),
        },
      });

      if (input.expenseId) {
        await tx.expense.update({
          where: { id: input.expenseId },
          data: {
            paymentStatus: "PAID",
            accountId: account.id,
          },
        });
      }

      const ledgerEntry = input.expenseId
        ? null
        : await tx.supplierLedgerEntry.create({
            data: {
              companyId: input.companyId,
              supplierId: input.supplierId,
              type: "PAYMENT",
              amount: amountParsed.amount,
              balanceEffect: paymentBalanceEffect(amountParsed.amount),
              date: paymentDate,
              description:
                input.description?.trim() || `${getSupplierDisplayName(supplier)} ödemesi`,
              accountTransactionId: transaction.id,
              sourceType: "SUPPLIER_PAYMENT",
              sourceId: transaction.id,
              idempotencyKey: input.idempotencyKey ?? null,
              createdByUserId: input.userId,
            },
            include: {
              accountTransaction: {
                include: { account: { select: { id: true, name: true } } },
              },
            },
          });

      await syncSupplierBalanceInTx(tx, input.companyId, input.supplierId);

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "PAYMENT",
          module: "suppliers",
          message: `${getSupplierDisplayName(supplier)} tedarikçisine ${amountParsed.amount.toFixed(2)} ${supplier.currency} ödeme yapıldı.`,
        },
      });

      return {
        ledgerEntry,
        transactionId: transaction.id,
        replay: false as const,
        overpaymentNotice,
      };
    });

    return result;
  } catch (error) {
    if (input.idempotencyKey && isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      const existing = await loadIdempotentLedgerEntry(db, input.companyId, input.idempotencyKey);
      if (existing) {
        assertIdempotentPaymentMatch(existing, {
          supplierId: input.supplierId,
          amount: amountParsed.amount,
          accountId: input.accountId,
        });
        return { ledgerEntry: existing, replay: true as const, overpaymentNotice: null };
      }
    }
    throw error;
  }
}

export async function createSupplierCollection(input: {
  companyId: string;
  supplierId: string;
  userId: string;
  accountId: string;
  amount: number;
  date?: Date;
  description?: string;
  idempotencyKey?: string;
}) {
  const amountParsed = parseSupplierFinanceAmount(input.amount);
  if (!amountParsed.ok) {
    throw new SupplierFinanceError(amountParsed.message);
  }

  const paymentDate = input.date ?? new Date();

  try {
    const result = await db.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await loadIdempotentLedgerEntry(
          tx,
          input.companyId,
          input.idempotencyKey
        );
        if (existing) {
          assertIdempotentCollectionMatch(existing, {
            supplierId: input.supplierId,
            amount: amountParsed.amount,
            accountId: input.accountId,
          });
          return { ledgerEntry: existing, replay: true as const };
        }
      }

      const supplier = await assertSupplierInCompany(tx, input.companyId, input.supplierId);
      const collectionValidation = validateSupplierCollectionAmount(
        amountParsed.amount,
        Number(supplier.currentBalance)
      );
      if (!collectionValidation.ok) {
        throw new SupplierFinanceError(collectionValidation.message);
      }

      const accountRecord = await tx.account.findFirst({
        where: { id: input.accountId },
      });

      const accountValidation = validateSupplierFinanceAccount(
        accountRecord,
        input.companyId,
        {
          paymentCurrency: supplier.currency,
          purpose: "collection",
        }
      );

      if (!accountValidation.ok) {
        throw new SupplierFinanceError(accountValidation.message);
      }

      const account = accountValidation.account;

      const transaction = await tx.accountTransaction.create({
        data: {
          accountId: account.id,
          supplierId: input.supplierId,
          type: "COLLECTION",
          title: `${getSupplierDisplayName(supplier)} tahsilatı`,
          amount: amountParsed.amount,
          date: paymentDate,
          note: input.description?.trim() || null,
        },
      });

      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: roundCashMoney(Number(account.balance) + amountParsed.amount),
        },
      });

      const ledgerEntry = await tx.supplierLedgerEntry.create({
        data: {
          companyId: input.companyId,
          supplierId: input.supplierId,
          type: "COLLECTION",
          amount: amountParsed.amount,
          balanceEffect: collectionBalanceEffect(amountParsed.amount),
          date: paymentDate,
          description:
            input.description?.trim() || `${getSupplierDisplayName(supplier)} tahsilatı`,
          accountTransactionId: transaction.id,
          sourceType: "SUPPLIER_COLLECTION",
          sourceId: transaction.id,
          idempotencyKey: input.idempotencyKey ?? null,
          createdByUserId: input.userId,
        },
        include: {
          accountTransaction: {
            include: { account: { select: { id: true, name: true } } },
          },
        },
      });

      await syncSupplierBalanceInTx(tx, input.companyId, input.supplierId);

      await tx.activityLog.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          action: "COLLECTION",
          module: "suppliers",
          message: `${getSupplierDisplayName(supplier)} tedarikçisinden ${amountParsed.amount.toFixed(2)} ${supplier.currency} tahsilat alındı.`,
        },
      });

      return { ledgerEntry, replay: false as const };
    });

    return result;
  } catch (error) {
    if (input.idempotencyKey && isPrismaUniqueConstraintError(error, "idempotencyKey")) {
      const existing = await loadIdempotentLedgerEntry(db, input.companyId, input.idempotencyKey);
      if (existing) {
        assertIdempotentCollectionMatch(existing, {
          supplierId: input.supplierId,
          amount: amountParsed.amount,
          accountId: input.accountId,
        });
        return { ledgerEntry: existing, replay: true as const };
      }
    }
    throw error;
  }
}

export async function createSupplierAdjustment(input: {
  companyId: string;
  supplierId: string;
  userId: string;
  amount: number;
  direction: "PAYABLE" | "RECEIVABLE";
  date?: Date;
  description: string;
  reason: string;
}) {
  const amountParsed = parseSupplierFinanceAmount(input.amount);
  if (!amountParsed.ok) {
    throw new SupplierFinanceError(amountParsed.message);
  }

  if (!input.description.trim() || !input.reason.trim()) {
    throw new SupplierFinanceError("Açıklama ve neden zorunludur.");
  }

  const adjustmentDate = input.date ?? new Date();
  const balanceEffect = adjustmentBalanceEffect(amountParsed.amount, input.direction);

  return db.$transaction(async (tx) => {
    const supplier = await assertSupplierInCompany(tx, input.companyId, input.supplierId);

    const ledgerEntry = await tx.supplierLedgerEntry.create({
      data: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        type: "ADJUSTMENT",
        amount: amountParsed.amount,
        balanceEffect,
        date: adjustmentDate,
        description: input.description.trim(),
        reason: input.reason.trim(),
        sourceType: "SUPPLIER_ADJUSTMENT",
        sourceId: `${input.supplierId}:${adjustmentDate.toISOString()}:${amountParsed.amount}`,
        createdByUserId: input.userId,
      },
    });

    await syncSupplierBalanceInTx(tx, input.companyId, input.supplierId);

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "ADJUSTMENT",
        module: "suppliers",
        message: `${getSupplierDisplayName(supplier)} cari düzeltmesi: ${input.description.trim()}`,
      },
    });

    return ledgerEntry;
  });
}

async function syncSupplierBalanceInTx(tx: Tx, companyId: string, supplierId: string) {
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, companyId },
    select: { openingBalance: true },
  });

  if (!supplier) {
    throw new SupplierFinanceError("Tedarikçi bulunamadı.", 404);
  }

  const [unpaid, ledgerAgg] = await Promise.all([
    tx.expense.aggregate({
      where: {
        companyId,
        supplierId,
        paymentStatus: "UNPAID",
        status: { not: "CANCELLED" },
      },
      _sum: { amount: true },
    }),
    tx.supplierLedgerEntry.aggregate({
      where: {
        companyId,
        supplierId,
        type: { in: ["PAYMENT", "COLLECTION", "ADJUSTMENT"] },
      },
      _sum: { balanceEffect: true },
    }),
  ]);

  const balance = roundCashMoney(
    Number(supplier.openingBalance) +
      Number(unpaid._sum.amount ?? 0) +
      Number(ledgerAgg._sum.balanceEffect ?? 0)
  );

  await tx.supplier.update({
    where: { id: supplierId },
    data: { currentBalance: balance },
  });

  return balance;
}

export async function syncSupplierBalanceAfterExpenseChange(
  companyId: string,
  supplierId: string | null | undefined
) {
  if (!supplierId) return;
  await syncSupplierBalance(companyId, supplierId);
}
