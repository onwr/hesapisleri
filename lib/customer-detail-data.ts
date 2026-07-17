import { db } from "@/lib/prisma";
import {
  getCustomerDebtDelta,
  getInvoiceEffectivePaidAmount,
} from "@/lib/customer-balance-utils";
import {
  formatCustomerMoney,
  getBalanceStatus,
} from "@/lib/customers-page-utils";
import { getSaleRemainingAmount, roundMoney } from "@/lib/sale-payment-utils";
import { parseCustomerFinanceNote } from "@/lib/customer-finance-utils";
import { getTimeMs, toIsoString } from "@/lib/format-utils";
import { isActiveSaleStatus } from "@/lib/sale-query-utils";

export type CustomerLedgerEntryType =
  | "SALE"
  | "INVOICE"
  | "COLLECTION"
  | "PAYMENT"
  | "CANCEL_SALE"
  | "CANCEL_INVOICE";

export type CustomerLedgerEntry = {
  id: string;
  occurredAt: string | null;
  date: Date | string;
  type: CustomerLedgerEntryType;
  label: string;
  reference: string;
  href?: string;
  debit: number;
  credit: number;
  balanceEffect: number;
  runningBalance: number;
};

export type CustomerOpenSale = {
  id: string;
  saleNo: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  createdAt: Date;
};

export type CustomerAccountSummary = {
  currentBalance: number;
  totalDebt: number;
  totalCollected: number;
  lastCollectionDate: string | null;
  balanceStatus: ReturnType<typeof getBalanceStatus>;
};

export async function getCustomerDetailRecord(
  companyId: string,
  customerId: string,
) {
  return db.customer.findFirst({
    where: {
      id: customerId,
      companyId,
    },
  });
}

export type CustomerDetailLedgerData = {
  summary: CustomerAccountSummary;
  ledger: CustomerLedgerEntry[];
  openSales: CustomerOpenSale[];
  recentSales: Array<{
    id: string;
    saleNo: string;
    total: number;
    paymentStatus: string;
    createdAt: Date;
  }>;
  recentInvoices: Array<{
    id: string;
    invoiceNo: string;
    total: number;
    paymentStatus: string;
    createdAt: Date;
  }>;
};

function matchesSaleNo(
  saleNo: string,
  tx: { title: string; note: string | null }
) {
  return tx.title.includes(saleNo) || (tx.note?.includes(saleNo) ?? false);
}

function resolveLedgerOccurredAt(
  ...candidates: (Date | string | null | undefined)[]
): string | null {
  for (const candidate of candidates) {
    const iso = toIsoString(candidate);
    if (iso) return iso;
  }
  return null;
}

function buildLedgerEntry(
  entry: Omit<CustomerLedgerEntry, "runningBalance" | "occurredAt" | "date">,
  ...dateCandidates: (Date | string | null | undefined)[]
): Omit<CustomerLedgerEntry, "runningBalance"> {
  const occurredAt = resolveLedgerOccurredAt(...dateCandidates);
  return {
    ...entry,
    occurredAt,
    date: occurredAt ?? "",
  };
}

export async function getCustomerDetailLedgerData(
  companyId: string,
  customerId: string
): Promise<CustomerDetailLedgerData> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId },
    select: { balance: true },
  });

  if (!customer) {
    throw new Error("Müşteri bulunamadı.");
  }

  const [sales, allCustomerInvoices] = await Promise.all([
    db.sale.findMany({
      where: { companyId, customerId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        saleNo: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.invoice.findMany({
      where: { companyId, customerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNo: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,
        status: true,
        saleId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const invoices = allCustomerInvoices.filter((invoice) => !invoice.saleId);

  const customerFinanceTransactions = await db.accountTransaction.findMany({
    where: {
      account: { companyId },
      note: { contains: `customerId=${customerId}` },
      type: { in: ["COLLECTION", "PAYMENT", "INCOME"] },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      title: true,
      amount: true,
      date: true,
      createdAt: true,
      note: true,
      type: true,
    },
  });

  const saleNos = sales.map((sale) => sale.saleNo);

  const collections =
    saleNos.length > 0
      ? await db.accountTransaction.findMany({
          where: {
            type: "INCOME",
            account: { companyId },
            OR: saleNos.flatMap((saleNo) => [
              { title: { contains: saleNo } },
              { note: { contains: saleNo } },
            ]),
          },
          orderBy: { date: "asc" },
          select: {
            id: true,
            title: true,
            amount: true,
            date: true,
            note: true,
          },
        })
      : [];

  const rawEntries: Omit<CustomerLedgerEntry, "runningBalance">[] = [];

  for (const sale of sales) {
    const total = Number(sale.total);
    const saleCollections = collections.filter((tx) =>
      matchesSaleNo(sale.saleNo, tx)
    );

    rawEntries.push(
      buildLedgerEntry(
        {
          id: `sale-${sale.id}`,
          type: "SALE",
          label:
            sale.paymentStatus === "UNPAID" ||
            sale.paymentStatus === "PARTIAL" ||
            Number(sale.paidAmount) < Number(sale.total)
              ? `Veresiye Satış · ${sale.saleNo}`
              : `Satış · ${sale.saleNo}`,
          reference: sale.saleNo,
          href: `/sales/${sale.id}`,
          debit: total,
          credit: 0,
          balanceEffect: total,
        },
        sale.createdAt
      )
    );

    for (const tx of saleCollections) {
      const amount = Number(tx.amount);
      rawEntries.push(
        buildLedgerEntry(
          {
            id: `collection-${tx.id}`,
            type: "COLLECTION",
            label: `Tahsilat · ${sale.saleNo}`,
            reference: sale.saleNo,
            href: `/cash-bank/transactions/${tx.id}`,
            debit: 0,
            credit: amount,
            balanceEffect: -amount,
          },
          tx.date
        )
      );
    }

    if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
      const collectedTotal = saleCollections.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
      const cancelEffect = roundMoney(-(total - collectedTotal));

      if (cancelEffect !== 0) {
        rawEntries.push(
          buildLedgerEntry(
            {
              id: `cancel-sale-${sale.id}`,
              type: "CANCEL_SALE",
              label: `Satış iptali · ${sale.saleNo}`,
              reference: sale.saleNo,
              href: `/sales/${sale.id}`,
              debit: cancelEffect > 0 ? cancelEffect : 0,
              credit: cancelEffect < 0 ? Math.abs(cancelEffect) : 0,
              balanceEffect: cancelEffect,
            },
            sale.updatedAt,
            sale.createdAt
          )
        );
      }
    }
  }

  for (const invoice of invoices) {
    if (invoice.status === "DRAFT") continue;

    const total = Number(invoice.total);
    const effectivePaid = getInvoiceEffectivePaidAmount(invoice);
    const debt = getCustomerDebtDelta(total, effectivePaid);

    if (invoice.status === "CANCELLED") {
      if (debt > 0) {
        rawEntries.push(
          buildLedgerEntry(
            {
              id: `invoice-${invoice.id}`,
              type: "INVOICE",
              label: `Fatura ${invoice.invoiceNo}`,
              reference: invoice.invoiceNo,
              href: `/invoices/${invoice.id}`,
              debit: debt,
              credit: 0,
              balanceEffect: debt,
            },
            invoice.createdAt
          )
        );
      }

      rawEntries.push(
        buildLedgerEntry(
          {
            id: `cancel-invoice-${invoice.id}`,
            type: "CANCEL_INVOICE",
            label: `Fatura iptali · ${invoice.invoiceNo}`,
            reference: invoice.invoiceNo,
            href: `/invoices/${invoice.id}`,
            debit: 0,
            credit: debt > 0 ? debt : total,
            balanceEffect: debt > 0 ? -debt : -total,
          },
          invoice.updatedAt,
          invoice.createdAt
        )
      );
      continue;
    }

    if (debt <= 0) continue;

    rawEntries.push(
      buildLedgerEntry(
        {
          id: `invoice-${invoice.id}`,
          type: "INVOICE",
          label: `Manuel fatura ${invoice.invoiceNo}`,
          reference: invoice.invoiceNo,
          href: `/invoices/${invoice.id}`,
          debit: debt,
          credit: 0,
          balanceEffect: debt,
        },
        invoice.createdAt
      )
    );
  }

  for (const tx of customerFinanceTransactions) {
    const meta = parseCustomerFinanceNote(tx.note);
    if (!meta || meta.customerId !== customerId) continue;

    const amount = Number(tx.amount);
    if (meta.kind === "collection") {
      rawEntries.push(
        buildLedgerEntry(
          {
            id: `customer-collection-${tx.id}`,
            type: "COLLECTION",
            label: tx.title || "Müşteri tahsilatı",
            reference: "Cari tahsilat",
            href: `/cash-bank/transactions/${tx.id}`,
            debit: 0,
            credit: amount,
            balanceEffect: -amount,
          },
          tx.date,
          tx.createdAt
        )
      );
      continue;
    }

    rawEntries.push(
      buildLedgerEntry(
        {
          id: `customer-payment-${tx.id}`,
          type: "PAYMENT",
          label: tx.title || "Müşteriye ödeme",
          reference: "Cari ödeme",
          href: `/cash-bank/transactions/${tx.id}`,
          debit: amount,
          credit: 0,
          balanceEffect: amount,
        },
        tx.date,
        tx.createdAt
      )
    );
  }

  rawEntries.sort((a, b) => {
    const aTime = getTimeMs(a.occurredAt) ?? 0;
    const bTime = getTimeMs(b.occurredAt) ?? 0;
    return aTime - bTime || a.id.localeCompare(b.id);
  });

  let running = 0;
  const ledgerAsc = rawEntries.map((entry) => {
    running = roundMoney(running + entry.balanceEffect);
    return { ...entry, runningBalance: running };
  });

  const ledger = [...ledgerAsc].reverse();

  const totalDebt = roundMoney(
    sales
      .filter((sale) => isActiveSaleStatus(sale.status))
      .reduce((sum, sale) => sum + Number(sale.total), 0)
  );

  const totalCollected = roundMoney(
    collections
      .filter((tx) =>
        sales.some(
          (sale) =>
            isActiveSaleStatus(sale.status) && matchesSaleNo(sale.saleNo, tx)
        )
      )
      .reduce((sum, tx) => sum + Number(tx.amount), 0)
  );

  const collectionOccurredAt = rawEntries
    .filter((entry) => entry.type === "COLLECTION")
    .map((entry) => entry.occurredAt)
    .filter((value): value is string => Boolean(value));

  const lastCollectionDate =
    collectionOccurredAt.length > 0
      ? collectionOccurredAt.reduce((latest, iso) => {
          const latestMs = getTimeMs(latest) ?? 0;
          const isoMs = getTimeMs(iso) ?? 0;
          return isoMs > latestMs ? iso : latest;
        })
      : null;

  const currentBalance = Number(customer.balance);

  const openSales = sales
    .filter(
      (sale) => sale.status !== "CANCELLED" && sale.status !== "REFUNDED"
    )
    .map((sale) => {
      const total = Number(sale.total);
      const paidAmount = Number(sale.paidAmount);
      const remainingAmount = getSaleRemainingAmount(total, paidAmount);

      return {
        id: sale.id,
        saleNo: sale.saleNo,
        total,
        paidAmount,
        remainingAmount,
        paymentStatus: sale.paymentStatus,
        createdAt: sale.createdAt,
      };
    })
    .filter((sale) => sale.remainingAmount > 0)
    .sort(
      (a, b) => (getTimeMs(b.createdAt) ?? 0) - (getTimeMs(a.createdAt) ?? 0)
    );

  const recentSales = [...sales]
    .sort(
      (a, b) => (getTimeMs(b.createdAt) ?? 0) - (getTimeMs(a.createdAt) ?? 0)
    )
    .slice(0, 5)
    .map((sale) => ({
      id: sale.id,
      saleNo: sale.saleNo,
      total: Number(sale.total),
      paymentStatus: sale.paymentStatus,
      createdAt: sale.createdAt,
    }));

  const recentInvoices = allCustomerInvoices.slice(0, 5).map((invoice) => ({
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    total: Number(invoice.total),
    paymentStatus: invoice.paymentStatus,
    createdAt: invoice.createdAt,
  }));

  return {
    summary: {
      currentBalance,
      totalDebt,
      totalCollected,
      lastCollectionDate,
      balanceStatus: getBalanceStatus(currentBalance),
    },
    ledger,
    openSales,
    recentSales,
    recentInvoices,
  };
}

export { formatCustomerMoney };
