import { createNotification } from "@/lib/notification-service";
import { db } from "@/lib/prisma";
import { applyCustomerCollection } from "@/lib/customer-balance-utils";
import {
  buildInvoiceCollectionTitle,
  collectInvoiceSchema,
  getInvoiceRemainingAmount,
  resolveInvoicePaidState,
  validateInvoiceCancelEligibility,
  validateInvoiceCollectEligibility,
  type CollectInvoiceInput,
} from "@/lib/invoice-payment-utils";
import { parseExpenseDate } from "@/lib/expense-utils";
import {
  derivePaymentStatus,
  roundMoney,
} from "@/lib/sale-payment-utils";

export { collectInvoiceSchema } from "@/lib/invoice-payment-utils";

type TransactionClient = Omit<
  typeof db,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type SerializedInvoiceAccount = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

export type SerializedInvoiceCollection = {
  id: string;
  title: string;
  amount: number;
  date: Date;
  note: string | null;
  accountName: string;
};

export type SerializedInvoiceDetail = {
  id: string;
  invoiceNo: string;
  type: string;
  status: string;
  paymentStatus: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Date | null;
  createdAt: Date;
  saleId: string | null;
  saleNo: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  collections: SerializedInvoiceCollection[];
  canCollect: boolean;
  canCancel: boolean;
};

export async function getInvoiceCollectionAccounts(companyId: string) {
  const accounts = await db.account.findMany({
    where: { companyId, status: "ACTIVE" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      balance: true,
    },
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: Number(account.balance),
  }));
}

export async function getInvoiceDetailForPage(companyId: string, invoiceId: string) {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, companyId },
    include: {
      customer: true,
      sale: true,
      transactions: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          account: true,
        },
      },
    },
  });

  if (!invoice) {
    return null;
  }

  const total = Number(invoice.total);
  const paidAmount = Number(invoice.paidAmount);
  const remainingAmount = getInvoiceRemainingAmount(total, paidAmount);
  const collectEligibility = validateInvoiceCollectEligibility(invoice);
  const cancelEligibility = validateInvoiceCancelEligibility(invoice);

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    type: invoice.type,
    status: invoice.status,
    paymentStatus: invoice.paymentStatus,
    total,
    paidAmount,
    remainingAmount,
    dueDate: invoice.dueDate,
    createdAt: invoice.createdAt,
    saleId: invoice.saleId,
    saleNo: invoice.sale?.saleNo ?? null,
    customer: invoice.customer
      ? {
          id: invoice.customer.id,
          name: invoice.customer.name,
          phone: invoice.customer.phone,
          email: invoice.customer.email,
        }
      : null,
    collections: invoice.transactions.map((transaction) => ({
      id: transaction.id,
      title: transaction.title,
      amount: Number(transaction.amount),
      date: transaction.date,
      note: transaction.note,
      accountName: transaction.account.name,
    })),
    canCollect: collectEligibility.ok,
    canCancel: cancelEligibility.ok && invoice.status !== "APPROVED",
  } satisfies SerializedInvoiceDetail;
}

async function recordInvoiceCollection(
  tx: TransactionClient,
  input: {
    companyId: string;
    accountId: string;
    invoiceId: string;
    invoiceNo: string;
    amount: number;
    collectedAt: Date;
    note?: string | null;
  }
) {
  const account = await tx.account.findFirst({
    where: {
      id: input.accountId,
      companyId: input.companyId,
      status: "ACTIVE",
    },
  });

  if (!account) {
    return {
      ok: false as const,
      status: 404,
      message: "Ödeme hesabı bulunamadı.",
    };
  }

  const amount = roundMoney(input.amount);

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
      title: buildInvoiceCollectionTitle(input.invoiceNo),
      amount,
      date: input.collectedAt,
      note:
        input.note ??
        `${input.invoiceNo} numaralı fatura tahsilatı (${account.name}).`,
      invoiceId: input.invoiceId,
    },
  });

  return { ok: true as const, account };
}

export async function collectInvoicePayment(input: {
  companyId: string;
  userId: string;
  invoiceId: string;
  data: CollectInvoiceInput;
}) {
  const collectedAt = input.data.collectedAt?.trim()
    ? parseExpenseDate(input.data.collectedAt)
    : new Date();

  if (input.data.collectedAt?.trim() && !collectedAt) {
    return {
      ok: false as const,
      status: 400,
      message: "Geçerli bir tahsilat tarihi girin.",
    };
  }

  const collectAmount = roundMoney(input.data.amount);

  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: {
        id: input.invoiceId,
        companyId: input.companyId,
      },
      include: {
        sale: true,
      },
    });

    if (!invoice) {
      return {
        ok: false as const,
        status: 404,
        message: "Fatura bulunamadı.",
      };
    }

    const eligibility = validateInvoiceCollectEligibility(invoice);
    if (!eligibility.ok) {
      return {
        ok: false as const,
        status: 400,
        message: eligibility.message,
      };
    }

    if (collectAmount > eligibility.remaining) {
      return {
        ok: false as const,
        status: 400,
        message: `En fazla ${eligibility.remaining.toFixed(2)} TL tahsil edebilirsiniz.`,
      };
    }

    const collectionResult = await recordInvoiceCollection(tx, {
      companyId: input.companyId,
      accountId: input.data.accountId,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      amount: collectAmount,
      collectedAt: collectedAt!,
      note: input.data.note?.trim() || null,
    });

    if (!collectionResult.ok) {
      return collectionResult;
    }

    const currentPaid = eligibility.effectivePaid;
    const nextPaidState = resolveInvoicePaidState(
      eligibility.total,
      currentPaid + collectAmount
    );

    const updatedInvoice = await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: nextPaidState.paidAmount,
        paymentStatus: nextPaidState.paymentStatus,
      },
    });

    if (invoice.saleId && invoice.sale) {
      const saleTotal = Number(invoice.sale.total);
      const saleNextPaid = roundMoney(Number(invoice.sale.paidAmount) + collectAmount);
      const cappedSalePaid = roundMoney(Math.min(saleTotal, saleNextPaid));

      await tx.sale.update({
        where: { id: invoice.sale.id },
        data: {
          paidAmount: cappedSalePaid,
          paymentStatus: derivePaymentStatus(saleTotal, cappedSalePaid),
        },
      });
    }

    if (invoice.customerId) {
      await applyCustomerCollection(tx, invoice.customerId, collectAmount);
    }

    await tx.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        module: "invoices",
        message: `${invoice.invoiceNo} numaralı faturadan ${collectAmount.toFixed(2)} TL tahsil edildi.`,
      },
    });

    await createNotification(
      {
        companyId: input.companyId,
        userId: input.userId,
        type: nextPaidState.paymentStatus === "PAID" ? "SUCCESS" : "INFO",
        category: "INVOICES",
        module: "invoices",
        entityType: "INVOICE",
        entityId: invoice.id,
        actionUrl: `/invoices/${invoice.id}`,
        title:
          nextPaidState.paymentStatus === "PAID"
            ? "Fatura tahsilatı tamamlandı"
            : "Kısmi fatura tahsilatı alındı",
        message: `${invoice.invoiceNo} için ${collectAmount.toFixed(2)} TL tahsil edildi.`,
      },
      tx
    );

    return {
      ok: true as const,
      data: {
        ...updatedInvoice,
        total: Number(updatedInvoice.total),
        paidAmount: Number(updatedInvoice.paidAmount),
        remainingAmount: getInvoiceRemainingAmount(
          Number(updatedInvoice.total),
          Number(updatedInvoice.paidAmount)
        ),
        paymentStatus: nextPaidState.paymentStatus,
      },
    };
  });
}

export { validateInvoiceCancelEligibility };
