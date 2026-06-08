import type { PaymentStatus } from "@prisma/client";
import { db } from "@/lib/prisma";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type SalePaymentMethod = "CASH" | "BANK";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getSaleRemainingAmount(total: number, paidAmount: number) {
  return Math.max(0, roundMoney(total - paidAmount));
}

export function derivePaymentStatus(
  total: number,
  paidAmount: number
): PaymentStatus {
  const paid = roundMoney(paidAmount);

  if (paid <= 0) return "UNPAID";
  if (paid >= roundMoney(total)) return "PAID";
  return "PARTIAL";
}

export function resolveSalePayment(input: {
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
  total: number;
  paidAmount?: number;
  collectedAmount?: number;
}) {
  const total = roundMoney(input.total);
  const collected =
    input.collectedAmount ?? input.paidAmount ?? undefined;

  if (input.paymentStatus === "PAID") {
    return {
      paidAmount: total,
      paymentStatus: "PAID" as const,
    };
  }

  if (input.paymentStatus === "UNPAID") {
    return {
      paidAmount: 0,
      paymentStatus: "UNPAID" as const,
    };
  }

  const paidAmount = roundMoney(collected ?? 0);

  if (paidAmount <= 0) {
    throw new Error(
      "Kısmi ödeme için tahsil edilen tutar sıfırdan büyük olmalıdır."
    );
  }

  if (paidAmount >= total) {
    return {
      paidAmount: total,
      paymentStatus: "PAID" as const,
    };
  }

  return {
    paidAmount,
    paymentStatus: "PARTIAL" as const,
  };
}

export function getPaymentMethodLabel(method: SalePaymentMethod) {
  return method === "BANK" ? "Banka / Havale" : "Nakit Kasa";
}

export async function getDefaultCollectionAccount(
  tx: TransactionClient,
  companyId: string,
  paymentMethod: SalePaymentMethod
) {
  return tx.account.findFirst({
    where: {
      companyId,
      type: paymentMethod === "BANK" ? "BANK" : "CASH",
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function ensureCollectionAccount(
  tx: TransactionClient,
  companyId: string,
  paymentMethod: SalePaymentMethod
) {
  const existing = await getDefaultCollectionAccount(
    tx,
    companyId,
    paymentMethod
  );

  if (existing) {
    return existing;
  }

  return tx.account.create({
    data: {
      companyId,
      type: paymentMethod === "BANK" ? "BANK" : "CASH",
      name: paymentMethod === "BANK" ? "Banka Hesabı" : "Nakit Kasa",
      currency: "TRY",
    },
  });
}

export async function recordSaleCollection(
  tx: TransactionClient,
  input: {
    companyId: string;
    saleNo: string;
    amount: number;
    paymentMethod: SalePaymentMethod;
    accountId?: string;
    note?: string;
  }
) {
  const amount = roundMoney(input.amount);

  if (amount <= 0) {
    return null;
  }

  let account;

  if (input.accountId) {
    account = await tx.account.findFirst({
      where: {
        id: input.accountId,
        companyId: input.companyId,
        status: "ACTIVE",
      },
    });

    if (!account) {
      throw new Error("Seçilen ödeme hesabı bulunamadı.");
    }
  } else {
    account = await ensureCollectionAccount(
      tx,
      input.companyId,
      input.paymentMethod
    );
  }

  await tx.account.update({
    where: { id: account.id },
    data: {
      balance: {
        increment: amount,
      },
    },
  });

  await tx.accountTransaction.create({
    data: {
      accountId: account.id,
      type: "INCOME",
      title: `Satış Tahsilatı - ${input.saleNo}`,
      amount,
      date: new Date(),
      note:
        input.note ??
        `${getPaymentMethodLabel(input.paymentMethod)} ile ${input.saleNo} numaralı satış tahsilatı.`,
    },
  });

  return account;
}

export function getCollectedAmount(total: number, paidAmount: number) {
  return Math.min(roundMoney(total), roundMoney(paidAmount));
}
