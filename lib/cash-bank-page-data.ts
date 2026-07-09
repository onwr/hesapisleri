import { db } from "@/lib/prisma";
import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getTransactionDirection } from "@/lib/cash-bank-account-utils";
import { resolveCashBankTransactionMutationContext } from "@/lib/cash-bank-transaction-row-utils";
import { isFinanceMirrorTransaction } from "@/lib/finance-reversal-utils";
import {
  buildBalanceBreakdown,
  formatCashMoney,
  getTransactionText,
  type BalanceBreakdownItem,
  type BankAccountRow,
  type CashAccountRow,
  type CashBankStatCard,
  type CashBankTabKey,
  type TransactionRow,
} from "@/lib/cash-bank-page-utils";

export type {
  BalanceBreakdownItem,
  BankAccountRow,
  CashAccountRow,
  CashBankStatCard,
  CashBankTabKey,
  TransactionRow,
} from "@/lib/cash-bank-page-utils";
export {
  buildCashBankQuery,
  CASH_BANK_TAB_LABELS,
  formatCashDate,
  formatCashMoney,
  getAccountStatusBadge,
  getAccountTypeText,
  getTransactionColor,
  getTransactionText,
  parseCashBankTab,
  parsePage,
  parseSearchQuery,
} from "@/lib/cash-bank-page-utils";

const PAGE_SIZE = 10;

type RawTransaction = TransactionRow & { createdAt: Date };

function matchesAccountSearch(
  account: {
    name: string;
    bankName?: string | null;
    iban?: string | null;
  },
  query: string
) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    account.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (account.bankName?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    (account.iban?.replace(/\s/g, "").includes(query.replace(/\s/g, "")) ?? false)
  );
}

function matchesTransactionSearch(transaction: RawTransaction, query: string) {
  const normalized = query.toLocaleLowerCase("tr-TR");

  return (
    transaction.title.toLocaleLowerCase("tr-TR").includes(normalized) ||
    transaction.accountName.toLocaleLowerCase("tr-TR").includes(normalized) ||
    (transaction.bankName?.toLocaleLowerCase("tr-TR").includes(normalized) ?? false) ||
    getTransactionText(transaction.type).toLocaleLowerCase("tr-TR").includes(normalized)
  );
}

function filterTransactionsByTab(
  transactions: RawTransaction[],
  tab: CashBankTabKey
) {
  switch (tab) {
    case "transfers":
      return transactions.filter((item) => item.type === "TRANSFER");
    case "pending":
      return transactions.filter((item) => item.type === "PAYMENT");
    case "movements":
      return transactions;
    default:
      return transactions;
  }
}

export async function getCashBankPageData(
  companyId: string,
  options: {
    tab: CashBankTabKey;
    page: number;
    q?: string | null;
  }
) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const accounts = await db.account.findMany({
    where: { companyId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const cashAccountsRaw = accounts.filter(
    (account) => account.type === "CASH" || account.type === "POS"
  );
  const bankAccountsRaw = accounts.filter(
    (account) =>
      account.type === "BANK" ||
      account.type === "CREDIT_CARD" ||
      account.type === "OTHER" ||
      account.type === "STATIC"
  );

  const cashTotal = cashAccountsRaw.reduce(
    (sum, account) => sum + Number(account.balance),
    0
  );
  const bankTotal = bankAccountsRaw.reduce(
    (sum, account) => sum + Number(account.balance),
    0
  );
  const totalBalance = cashTotal + bankTotal;

  const transferGroupIds = Array.from(
    new Set(
      accounts
        .flatMap((account) => account.transactions)
        .map((transaction) => transaction.transferGroupId)
        .filter((value): value is string => Boolean(value))
    )
  );

  const cancelledTransferKeys =
    transferGroupIds.length > 0
      ? await db.accountTransferIdempotency.findMany({
          where: {
            companyId,
            status: "COMPLETED",
            OR: transferGroupIds.map((groupId) => ({
              idempotencyKey: `cancel-transfer:${groupId}`,
            })),
          },
          select: { idempotencyKey: true },
        })
      : [];

  const cancelledTransferGroupIds = new Set(
    cancelledTransferKeys.map((entry) =>
      entry.idempotencyKey.replace(/^cancel-transfer:/, "")
    )
  );

  const allTransactions: RawTransaction[] = accounts
    .flatMap((account) =>
      account.transactions.map((transaction) => {
        const mutation = resolveCashBankTransactionMutationContext(transaction);
        const isMirror = isFinanceMirrorTransaction(transaction);
        const isTransfer = mutation.isTransfer;
        const transferCancelled =
          Boolean(transaction.transferGroupId) &&
          cancelledTransferGroupIds.has(transaction.transferGroupId!);

        return {
          id: transaction.id,
          date: new Date(transaction.date),
          createdAt: new Date(transaction.createdAt),
          title: transaction.title,
          type: transaction.type,
          amount: Number(transaction.amount),
          accountName: account.name,
          accountType: account.type,
          bankName: account.bankName,
          accountId: account.id,
          direction: getTransactionDirection(transaction),
          expenseId: transaction.expenseId,
          invoiceId: transaction.invoiceId,
          supplierId: transaction.supplierId,
          transferGroupId: transaction.transferGroupId,
          isLinked: mutation.isLinked,
          isTransfer,
          isMirror,
          transferCancelled,
          lifecycleActions:
            transferCancelled || isMirror
              ? {
                  view: true,
                  edit: false,
                  delete: false,
                  cancel: false,
                  reverse: false,
                  archive: false,
                  restore: false,
                }
              : isTransfer
                ? {
                    view: true,
                    edit: false,
                    delete: false,
                    cancel: true,
                    reverse: false,
                    archive: false,
                    restore: false,
                  }
                : mutation.lifecycleActions,
          linkedHref: mutation.linkedHref,
        };
      })
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const monthTransactions = allTransactions.filter(
    (transaction) =>
      transaction.createdAt >= monthStart && transaction.createdAt <= monthEnd
  );

  const pendingTransactions = allTransactions.filter(
    (transaction) => transaction.type === "PAYMENT"
  );
  const pendingTotal = pendingTransactions.reduce(
    (sum, transaction) => sum + transaction.amount,
    0
  );

  const statCards: CashBankStatCard[] = [
    {
      title: "Toplam Kasa Bakiyesi",
      value: formatCashMoney(cashTotal),
      subtitle: `${cashAccountsRaw.length} kasa hesabı`,
      iconKey: "wallet",
      color: "emerald",
    },
    {
      title: "Toplam Banka Bakiyesi",
      value: formatCashMoney(bankTotal),
      subtitle: `${bankAccountsRaw.length} banka hesabı`,
      iconKey: "building",
      color: "blue",
    },
    {
      title: "Toplam Bakiye",
      value: formatCashMoney(totalBalance),
      subtitle: "Tüm hesaplar toplamı",
      iconKey: "pie",
      color: "violet",
    },
    {
      title: "Bekleyen İşlemler",
      value: formatCashMoney(pendingTotal),
      subtitle: `${pendingTransactions.length} işlem bekliyor`,
      iconKey: "clock",
      color: "orange",
    },
    {
      title: "Bu Ay İşlem Sayısı",
      value: String(monthTransactions.length),
      subtitle: "Bu ay oluşan hareketler",
      iconKey: "refresh",
      color: "emerald",
    },
  ];

  let cashAccounts: CashAccountRow[] = cashAccountsRaw.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    bankName: account.bankName,
    branchName: account.branchName,
    iban: account.iban,
    accountNumber: account.accountNumber,
    balance: Number(account.balance),
    currency: account.currency,
    status: account.status,
    isDefault: account.isDefault,
    description: account.description,
  }));

  let bankAccounts: BankAccountRow[] = bankAccountsRaw.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    bankName: account.bankName,
    branchName: account.branchName,
    iban: account.iban,
    accountNumber: account.accountNumber,
    balance: Number(account.balance),
    currency: account.currency,
    status: account.status,
    isDefault: account.isDefault,
    description: account.description,
  }));

  if (options.q) {
    cashAccounts = cashAccounts.filter((account) =>
      matchesAccountSearch(account, options.q!)
    );
    bankAccounts = bankAccounts.filter((account) =>
      matchesAccountSearch(account, options.q!)
    );
  }

  let filteredTransactions = filterTransactionsByTab(allTransactions, options.tab);

  if (options.q) {
    filteredTransactions = filteredTransactions.filter((transaction) =>
      matchesTransactionSearch(transaction, options.q!)
    );
  }

  const totalRecords =
    options.tab === "accounts"
      ? cashAccounts.length + bankAccounts.length
      : filteredTransactions.length;

  const totalPages =
    options.tab === "accounts"
      ? 1
      : Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));

  const currentPage =
    options.tab === "accounts" ? 1 : Math.min(options.page, totalPages);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const transactionRows =
    options.tab === "accounts"
      ? []
      : filteredTransactions.slice(startIndex, startIndex + PAGE_SIZE);

  const balanceBreakdown = buildBalanceBreakdown(
    cashTotal,
    bankAccountsRaw.map((account) => ({
      name: account.name,
      bankName: account.bankName,
      balance: Number(account.balance),
    }))
  );

  return {
    statCards,
    cashAccounts,
    bankAccounts,
    transactionRows,
    balanceBreakdown,
    recentTransactions: allTransactions.slice(0, 5),
    totalBalance,
    cashTotal,
    bankTotal,
    monthTransactionCount: monthTransactions.length,
    totalRecords,
    totalPages,
    currentPage,
    pageSize: PAGE_SIZE,
  };
}
