import { db } from "@/lib/prisma";
import { getAccountTransactionTypeLabel } from "@/lib/cash-bank/account-transaction-labels";
import {
  extractTransactionReference,
  getTransactionDirection,
  inferTransactionSource,
} from "@/lib/cash-bank-account-utils";

export type AccountTransactionDetailLink = {
  id: string;
  label: string;
};

export type AccountTransactionDetail = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  type: string;
  typeLabel: string;
  direction: "in" | "out";
  directionLabel: string;
  sourceLabel: string;
  statusLabel: string;
  paymentMethodLabel: string | null;
  reference: string | null;
  date: Date;
  createdAt: Date;
  note: string | null;
  account: { id: string; name: string; type: string };
  counterAccount: AccountTransactionDetailLink | null;
  pairedTransaction: AccountTransactionDetailLink | null;
  reversal: { label: string; transactionId: string | null } | null;
  createdBy: AccountTransactionDetailLink | null;
  customer: AccountTransactionDetailLink | null;
  sale: AccountTransactionDetailLink | null;
  invoice: (AccountTransactionDetailLink & { saleId: string | null }) | null;
  expense: AccountTransactionDetailLink | null;
  supplier: AccountTransactionDetailLink | null;
  employee: AccountTransactionDetailLink | null;
};

function resolveStatusLabel(
  title: string,
  sourceKey: ReturnType<typeof inferTransactionSource>["key"],
): string {
  const normalized = title.toLocaleLowerCase("tr-TR");
  if (sourceKey === "cancel" || normalized.includes("iptal")) return "İptal";
  if (normalized.includes("ters") || normalized.includes("iade")) return "Ters kayıt";
  return "Tamamlandı";
}

function resolvePaymentMethodLabel(input: {
  accountType: string;
  type: string;
  sourceKey: ReturnType<typeof inferTransactionSource>["key"];
}): string | null {
  if (input.type === "COLLECTION") return "Tahsilat";
  if (input.type === "PAYMENT") return "Ödeme";
  if (input.type === "TRANSFER") return "Transfer";
  if (input.sourceKey === "manual") {
    return input.accountType === "BANK" ? "Banka" : "Kasa";
  }
  return null;
}

async function findPairedTransferTransaction(
  companyId: string,
  transaction: {
    id: string;
    type: string;
    title: string;
    amount: unknown;
    date: Date;
    accountId: string;
  },
  direction: "in" | "out",
): Promise<{
  id: string;
  title: string;
  account: { id: string; name: string };
} | null> {
  if (transaction.type !== "TRANSFER") return null;

  const amountValue = Number(transaction.amount);
  const windowStart = new Date(transaction.date.getTime() - 3000);
  const windowEnd = new Date(transaction.date.getTime() + 3000);
  const oppositeDirection = direction === "in" ? "out" : "in";

  const candidates = await db.accountTransaction.findMany({
    where: {
      id: { not: transaction.id },
      type: "TRANSFER",
      amount: amountValue,
      date: { gte: windowStart, lte: windowEnd },
      accountId: { not: transaction.accountId },
      account: { companyId },
    },
    include: {
      account: { select: { id: true, name: true } },
    },
    take: 8,
  });

  return (
    candidates.find(
      (candidate) => getTransactionDirection(candidate) === oppositeDirection,
    ) ?? null
  );
}

async function findLinkedSale(
  companyId: string,
  reference: string | null,
  saleId: string | null | undefined,
) {
  if (saleId) {
    const sale = await db.sale.findFirst({
      where: { id: saleId, companyId },
      select: { id: true, saleNo: true },
    });
    if (sale) {
      return { id: sale.id, label: sale.saleNo };
    }
  }

  if (!reference) return null;

  const sale = await db.sale.findFirst({
    where: { companyId, saleNo: reference },
    select: { id: true, saleNo: true },
  });

  if (!sale) return null;
  return { id: sale.id, label: sale.saleNo };
}

async function findReversalInfo(
  companyId: string,
  transaction: {
    id: string;
    accountId: string;
    type: string;
    title: string;
    amount: unknown;
  },
) {
  const normalized = transaction.title.toLocaleLowerCase("tr-TR");
  if (normalized.includes("iptal") || normalized.includes("ters") || normalized.includes("iade")) {
    return {
      label: normalized.includes("iptal") ? "İptal kaydı" : "Ters kayıt",
      transactionId: null,
    };
  }

  const mirror = await db.accountTransaction.findFirst({
    where: {
      id: { not: transaction.id },
      accountId: transaction.accountId,
      amount: Number(transaction.amount),
      account: { companyId },
      OR: [
        { title: { contains: "İptal" } },
        { title: { contains: "Ters" } },
        { note: { contains: transaction.title.slice(0, 24) } },
      ],
    },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });

  if (!mirror) return null;

  return {
    label: mirror.title,
    transactionId: mirror.id,
  };
}

export async function getAccountTransactionDetail(
  companyId: string,
  transactionId: string,
): Promise<AccountTransactionDetail | null> {
  const row = await db.accountTransaction.findFirst({
    where: {
      id: transactionId,
      account: { companyId },
    },
    include: {
      account: { select: { id: true, name: true, type: true, currency: true } },
      invoice: {
        select: {
          id: true,
          invoiceNo: true,
          saleId: true,
          customer: { select: { id: true, name: true } },
        },
      },
      expense: {
        select: {
          id: true,
          title: true,
          user: { select: { id: true, name: true } },
        },
      },
      supplier: { select: { id: true, name: true } },
      employeePayments: {
        take: 1,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!row) return null;

  const txLike = { type: row.type, title: row.title, note: row.note };
  const direction = getTransactionDirection(txLike);
  const source = inferTransactionSource(txLike);
  const reference = extractTransactionReference(row.title, row.note);
  const paired = await findPairedTransferTransaction(companyId, row, direction);
  const sale = await findLinkedSale(companyId, reference, row.invoice?.saleId);
  const reversal = await findReversalInfo(companyId, row);

  const createdBy = row.expense?.user
    ? { id: row.expense.user.id, label: row.expense.user.name }
    : null;

  const employeePayment = row.employeePayments[0];
  const employee = employeePayment?.employee
    ? {
        id: employeePayment.employee.id,
        label: `${employeePayment.employee.firstName} ${employeePayment.employee.lastName}`.trim(),
      }
    : null;

  return {
    id: row.id,
    title: row.title,
    amount: Number(row.amount),
    currency: row.account.currency,
    type: row.type,
    typeLabel: getAccountTransactionTypeLabel(row),
    direction,
    directionLabel: direction === "in" ? "Giriş" : "Çıkış",
    sourceLabel: source.label,
    statusLabel: resolveStatusLabel(row.title, source.key),
    paymentMethodLabel: resolvePaymentMethodLabel({
      accountType: row.account.type,
      type: row.type,
      sourceKey: source.key,
    }),
    reference,
    date: row.date,
    createdAt: row.createdAt,
    note: row.note,
    account: {
      id: row.account.id,
      name: row.account.name,
      type: row.account.type,
    },
    counterAccount: paired?.account
      ? { id: paired.account.id, label: paired.account.name }
      : null,
    pairedTransaction: paired
      ? { id: paired.id, label: paired.title }
      : null,
    reversal,
    createdBy,
    customer: row.invoice?.customer
      ? { id: row.invoice.customer.id, label: row.invoice.customer.name }
      : null,
    sale,
    invoice: row.invoice
      ? {
          id: row.invoice.id,
          label: row.invoice.invoiceNo,
          saleId: row.invoice.saleId,
        }
      : null,
    expense: row.expense
      ? { id: row.expense.id, label: row.expense.title }
      : null,
    supplier: row.supplier
      ? { id: row.supplier.id, label: row.supplier.name }
      : null,
    employee,
  };
}
