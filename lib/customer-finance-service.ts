import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import {
  applyCustomerCollection,
  adjustCustomerBalance,
} from "@/lib/customer-balance-utils";
import { runTransactionWithRetry } from "@/lib/prisma-transaction-utils";
import {
  buildCustomerFinanceNote,
  parseCustomerFinanceAmount,
  parseCustomerFinanceDate,
  validateCustomerFinanceAccount,
} from "@/lib/customer-finance-utils";
import { getCompanyAllowNegativeCashBalance } from "@/lib/cash-balance-policy";

export class CustomerFinanceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CustomerFinanceError";
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

async function assertCustomerInCompany(tx: Tx, companyId: string, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, companyId },
  });

  if (!customer) {
    throw new CustomerFinanceError("Müşteri bulunamadı.", 404);
  }

  return customer;
}

async function loadIdempotentCustomerTransaction(
  tx: Tx,
  companyId: string,
  idempotencyKey: string
) {
  return tx.accountTransaction.findFirst({
    where: {
      note: { contains: `idempotency=${idempotencyKey}` },
      account: { companyId },
    },
    include: {
      account: { select: { id: true, name: true } },
    },
  });
}

function assertIdempotentCustomerFinanceMatch(
  existing: {
    amount: unknown;
    note: string | null;
    accountId: string;
  },
  input: {
    customerId: string;
    kind: "collection" | "payment";
    amount: number;
    accountId: string;
  }
) {
  const note = existing.note ?? "";
  if (
    !note.includes(`customerId=${input.customerId}`) ||
    !note.includes(`kind=${input.kind}`) ||
    roundCashMoney(Number(existing.amount)) !== roundCashMoney(input.amount) ||
    existing.accountId !== input.accountId
  ) {
    throw new CustomerFinanceError(
      "Aynı idempotency anahtarı farklı işlem verisiyle kullanılamaz.",
      409
    );
  }
}

export async function createCustomerCollection(input: {
  companyId: string;
  customerId: string;
  userId: string;
  accountId: string;
  amount: number;
  date?: Date;
  description?: string;
  idempotencyKey?: string;
}) {
  const amountParsed = parseCustomerFinanceAmount(input.amount);
  if (!amountParsed.ok) {
    throw new CustomerFinanceError(amountParsed.message);
  }

  const paymentDate = input.date ?? new Date();

  return runTransactionWithRetry(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await loadIdempotentCustomerTransaction(
        tx,
        input.companyId,
        input.idempotencyKey
      );
      if (existing) {
        assertIdempotentCustomerFinanceMatch(existing, {
          customerId: input.customerId,
          kind: "collection",
          amount: amountParsed.amount,
          accountId: input.accountId,
        });
        return {
          transaction: existing,
          replay: true as const,
          customerBalance: null as number | null,
        };
      }
    }

    const customer = await assertCustomerInCompany(
      tx,
      input.companyId,
      input.customerId
    );

    const accountRecord = await tx.account.findFirst({
      where: { id: input.accountId },
    });

    const accountValidation = validateCustomerFinanceAccount(
      accountRecord,
      input.companyId,
      { purpose: "collection" }
    );

    if (!accountValidation.ok) {
      throw new CustomerFinanceError(accountValidation.message);
    }

    const account = accountValidation.account;

    const collectionNote = buildCustomerFinanceNote({
      customerId: input.customerId,
      kind: "collection",
      idempotencyKey: input.idempotencyKey,
    });
    const transaction = await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "COLLECTION",
        title: `${customer.name} tahsilatı`,
        amount: amountParsed.amount,
        date: paymentDate,
        note: input.description?.trim()
          ? `${input.description.trim()} | ${collectionNote}`
          : collectionNote,
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: {
        balance: roundCashMoney(Number(account.balance) + amountParsed.amount),
      },
    });

    await applyCustomerCollection(
      tx,
      input.companyId,
      input.customerId,
      amountParsed.amount
    );

    const updatedCustomer = await tx.customer.findFirst({
      where: { id: customer.id, companyId: input.companyId },
      select: { balance: true },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "COLLECTION",
        module: "customers",
        message: `${customer.name} müşterisinden ${amountParsed.amount.toFixed(2)} TL tahsilat alındı.`,
      },
    });

    return {
      transaction,
      replay: false as const,
      customerBalance: Number(updatedCustomer?.balance ?? customer.balance),
    };
  });
}

export async function createCustomerPayment(input: {
  companyId: string;
  customerId: string;
  userId: string;
  accountId: string;
  amount: number;
  date?: Date;
  description?: string;
  idempotencyKey?: string;
}) {
  const amountParsed = parseCustomerFinanceAmount(input.amount);
  if (!amountParsed.ok) {
    throw new CustomerFinanceError(amountParsed.message);
  }

  const paymentDate = input.date ?? new Date();
  const allowNegativeCashBalance = await getCompanyAllowNegativeCashBalance(
    input.companyId
  );

  return runTransactionWithRetry(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await loadIdempotentCustomerTransaction(
        tx,
        input.companyId,
        input.idempotencyKey
      );
      if (existing) {
        assertIdempotentCustomerFinanceMatch(existing, {
          customerId: input.customerId,
          kind: "payment",
          amount: amountParsed.amount,
          accountId: input.accountId,
        });
        return {
          transaction: existing,
          replay: true as const,
          customerBalance: null as number | null,
        };
      }
    }

    const customer = await assertCustomerInCompany(
      tx,
      input.companyId,
      input.customerId
    );

    const accountRecord = await tx.account.findFirst({
      where: { id: input.accountId },
    });

    const accountValidation = validateCustomerFinanceAccount(
      accountRecord,
      input.companyId,
      {
        purpose: "payment",
        amount: amountParsed.amount,
        checkBalance: true,
        allowNegativeCashBalance,
      }
    );

    if (!accountValidation.ok) {
      throw new CustomerFinanceError(accountValidation.message);
    }

    const account = accountValidation.account;

    const paymentNote = buildCustomerFinanceNote({
      customerId: input.customerId,
      kind: "payment",
      idempotencyKey: input.idempotencyKey,
    });
    const transaction = await tx.accountTransaction.create({
      data: {
        accountId: account.id,
        type: "PAYMENT",
        title: `${customer.name} ödemesi`,
        amount: amountParsed.amount,
        date: paymentDate,
        note: input.description?.trim()
          ? `${input.description.trim()} | ${paymentNote}`
          : paymentNote,
      },
    });

    await tx.account.update({
      where: { id: account.id },
      data: {
        balance: roundCashMoney(Number(account.balance) - amountParsed.amount),
      },
    });

    await adjustCustomerBalance(
      tx,
      input.companyId,
      input.customerId,
      amountParsed.amount
    );

    const updatedCustomer = await tx.customer.findFirst({
      where: { id: customer.id, companyId: input.companyId },
      select: { balance: true },
    });

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "PAYMENT",
        module: "customers",
        message: `${customer.name} müşterisine ${amountParsed.amount.toFixed(2)} TL ödeme yapıldı.`,
      },
    });

    return {
      transaction,
      replay: false as const,
      customerBalance: Number(updatedCustomer?.balance ?? customer.balance),
    };
  });
}

export async function findCustomerFinanceTransactionByIdempotency(
  companyId: string,
  idempotencyKey: string
) {
  return loadIdempotentCustomerTransaction(db, companyId, idempotencyKey);
}
