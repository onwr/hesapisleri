import { db } from "@/lib/prisma";
import { roundMoney } from "@/lib/sale-payment-utils";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** Müşterinin kalan borç tutarı (total - tahsil edilen, en az 0). */
export function getCustomerDebtDelta(total: number, paidAmount: number) {
  const totalRounded = roundMoney(total);
  const paidRounded = roundMoney(paidAmount);
  return roundMoney(Math.max(0, totalRounded - paidRounded));
}

export function resolveDocumentPaidAmount(input: {
  total: number;
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL" | "FAILED";
  collectedAmount?: number;
  paidAmount?: number;
}) {
  const collected = input.collectedAmount ?? input.paidAmount;

  if (input.paymentStatus === "PAID") {
    return roundMoney(input.total);
  }

  if (input.paymentStatus === "UNPAID" || input.paymentStatus === "FAILED") {
    return 0;
  }

  const paid = roundMoney(collected ?? 0);

  if (paid <= 0) {
    return 0;
  }

  return roundMoney(Math.min(paid, input.total));
}

export async function adjustCustomerBalance(
  tx: TransactionClient,
  customerId: string | null | undefined,
  delta: number
) {
  if (!customerId) return;

  const rounded = roundMoney(delta);
  if (rounded === 0) return;

  await tx.customer.update({
    where: { id: customerId },
    data: {
      balance: {
        increment: rounded,
      },
    },
  });
}

export async function applyCustomerDebtFromDocument(
  tx: TransactionClient,
  customerId: string | null | undefined,
  total: number,
  paidAmount: number
) {
  await adjustCustomerBalance(
    tx,
    customerId,
    getCustomerDebtDelta(total, paidAmount)
  );
}

export async function reverseCustomerDebtFromDocument(
  tx: TransactionClient,
  customerId: string | null | undefined,
  total: number,
  paidAmount: number
) {
  await adjustCustomerBalance(
    tx,
    customerId,
    -getCustomerDebtDelta(total, paidAmount)
  );
}

export async function applyCustomerCollection(
  tx: TransactionClient,
  customerId: string | null | undefined,
  amount: number
) {
  await adjustCustomerBalance(tx, customerId, -roundMoney(amount));
}

function resolveInvoicePaidAmountForRecalc(invoice: {
  total: unknown;
  paidAmount: unknown;
  paymentStatus: string;
}) {
  const total = Number(invoice.total);
  const storedPaid = Number(invoice.paidAmount);

  if (storedPaid > 0) {
    return roundMoney(Math.min(storedPaid, total));
  }

  if (invoice.paymentStatus === "PAID") {
    return roundMoney(total);
  }

  return 0;
}

export function getInvoiceEffectivePaidAmount(invoice: {
  total: unknown;
  paidAmount: unknown;
  paymentStatus: string;
}) {
  return resolveInvoicePaidAmountForRecalc(invoice);
}

/**
 * Tahsilat hareketlerinde (AccountTransaction) customerId alanı yok;
 * fazla tahsilat kredisi yalnızca canlı tahsilat akışında balance'a yansır.
 * Yeniden hesaplamada satış/fatura total-paidAmount kullanılır.
 */
export async function recalculateCustomerBalances(
  companyId: string,
  tx: TransactionClient = db
) {
  const customers = await tx.customer.findMany({
    where: { companyId },
    select: { id: true },
  });

  for (const customer of customers) {
    let balance = 0;

    const sales = await tx.sale.findMany({
      where: {
        companyId,
        customerId: customer.id,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: {
        total: true,
        paidAmount: true,
      },
    });

    for (const sale of sales) {
      balance += getCustomerDebtDelta(
        Number(sale.total),
        Number(sale.paidAmount)
      );
    }

    const invoices = await tx.invoice.findMany({
      where: {
        companyId,
        customerId: customer.id,
        saleId: null,
        status: { notIn: ["CANCELLED", "DRAFT"] },
      },
      select: {
        total: true,
        paidAmount: true,
        paymentStatus: true,
      },
    });

    for (const invoice of invoices) {
      const paidAmount = resolveInvoicePaidAmountForRecalc(invoice);
      balance += getCustomerDebtDelta(Number(invoice.total), paidAmount);
    }

    await tx.customer.update({
      where: { id: customer.id },
      data: {
        balance: roundMoney(balance),
      },
    });
  }

  return customers.length;
}
