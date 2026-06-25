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
import { isActiveSaleStatus } from "@/lib/sale-query-utils";

export type CustomerLedgerEntryType =
  | "SALE"
  | "INVOICE"
  | "COLLECTION"
  | "CANCEL_SALE"
  | "CANCEL_INVOICE";

export type CustomerLedgerEntry = {
  id: string;
  date: Date;
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
  lastCollectionDate: Date | null;
  balanceStatus: ReturnType<typeof getBalanceStatus>;
};

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

    rawEntries.push({
      id: `sale-${sale.id}`,
      date: sale.createdAt,
      type: "SALE",
      label: `Satış ${sale.saleNo}`,
      reference: sale.saleNo,
      href: `/sales/${sale.id}`,
      debit: total,
      credit: 0,
      balanceEffect: total,
    });

    for (const tx of saleCollections) {
      const amount = Number(tx.amount);
      rawEntries.push({
        id: `collection-${tx.id}`,
        date: tx.date,
        type: "COLLECTION",
        label: `Tahsilat · ${sale.saleNo}`,
        reference: sale.saleNo,
        href: `/sales/${sale.id}`,
        debit: 0,
        credit: amount,
        balanceEffect: -amount,
      });
    }

    if (sale.status === "CANCELLED" || sale.status === "REFUNDED") {
      const collectedTotal = saleCollections.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
      const cancelEffect = roundMoney(-(total - collectedTotal));

      if (cancelEffect !== 0) {
        rawEntries.push({
          id: `cancel-sale-${sale.id}`,
          date: sale.updatedAt,
          type: "CANCEL_SALE",
          label: `Satış iptali · ${sale.saleNo}`,
          reference: sale.saleNo,
          href: `/sales/${sale.id}`,
          debit: cancelEffect > 0 ? cancelEffect : 0,
          credit: cancelEffect < 0 ? Math.abs(cancelEffect) : 0,
          balanceEffect: cancelEffect,
        });
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
        rawEntries.push({
          id: `invoice-${invoice.id}`,
          date: invoice.createdAt,
          type: "INVOICE",
          label: `Fatura ${invoice.invoiceNo}`,
          reference: invoice.invoiceNo,
          href: `/invoices/${invoice.id}`,
          debit: debt,
          credit: 0,
          balanceEffect: debt,
        });
      }

      rawEntries.push({
        id: `cancel-invoice-${invoice.id}`,
        date: invoice.updatedAt,
        type: "CANCEL_INVOICE",
        label: `Fatura iptali · ${invoice.invoiceNo}`,
        reference: invoice.invoiceNo,
        href: `/invoices/${invoice.id}`,
        debit: 0,
        credit: debt > 0 ? debt : total,
        balanceEffect: debt > 0 ? -debt : -total,
      });
      continue;
    }

    if (debt <= 0) continue;

    rawEntries.push({
      id: `invoice-${invoice.id}`,
      date: invoice.createdAt,
      type: "INVOICE",
      label: `Manuel fatura ${invoice.invoiceNo}`,
      reference: invoice.invoiceNo,
      href: `/invoices/${invoice.id}`,
      debit: debt,
      credit: 0,
      balanceEffect: debt,
    });
  }

  rawEntries.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)
  );

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

  const collectionDates = rawEntries
    .filter((entry) => entry.type === "COLLECTION")
    .map((entry) => entry.date);

  const lastCollectionDate =
    collectionDates.length > 0
      ? collectionDates.reduce((latest, date) =>
          date.getTime() > latest.getTime() ? date : latest
        )
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
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const recentSales = [...sales]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
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
