export type CashBankTabKey = "accounts" | "movements" | "transfers" | "pending";

export type CashAccountRow = {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  balance: number;
  currency: string;
  status: string;
  isDefault: boolean;
  description: string | null;
};

export type BankAccountRow = {
  id: string;
  name: string;
  type: string;
  bankName: string | null;
  branchName: string | null;
  iban: string | null;
  accountNumber: string | null;
  balance: number;
  currency: string;
  status: string;
  isDefault: boolean;
  description: string | null;
};

export type TransactionRow = {
  id: string;
  date: Date;
  title: string;
  type: string;
  amount: number;
  accountName: string;
  accountType: string;
  bankName: string | null;
};

export type BalanceBreakdownItem = {
  name: string;
  total: number;
  percent: number;
  color: string;
};

export type CashBankStatCard = {
  title: string;
  value: string;
  subtitle: string;
  iconKey: "wallet" | "building" | "pie" | "clock" | "refresh";
  color: "emerald" | "blue" | "violet" | "orange";
};

export const CASH_BANK_TAB_LABELS: Record<CashBankTabKey, string> = {
  accounts: "Hesaplar",
  movements: "Hareketler",
  transfers: "Transferler",
  pending: "Bekleyen İşlemler",
};

export const BALANCE_CHART_COLORS = [
  "#22c55e",
  "#2563eb",
  "#7c3aed",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#94a3b8",
];

export function parseCashBankTab(value?: string | null): CashBankTabKey {
  if (
    value === "movements" ||
    value === "transfers" ||
    value === "pending"
  ) {
    return value;
  }

  return "accounts";
}

export function parsePage(value?: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parseSearchQuery(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export { formatMoney as formatCashMoney } from "@/lib/format-utils";

export function getCashBalanceClass(balance: number | string | null | undefined) {
  const numeric = Number(balance ?? 0);
  if (!Number.isFinite(numeric)) return "text-[#0f1f4d]";
  return numeric < 0 ? "text-rose-600" : "text-[#0f1f4d]";
}

export function formatCashDate(value: Date | string | number | null | undefined) {
  if (value == null) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function getAccountTypeText(type: string) {
  const labels: Record<string, string> = {
    CASH: "Kasa",
    BANK: "Banka",
    CREDIT_CARD: "Kredi Kartı",
    POS: "POS Hesabı",
    OTHER: "Diğer",
    STATIC: "Diğer",
  };

  return labels[type] ?? type;
}

export function getAccountStatusBadge(status: string) {
  if (status === "ACTIVE") {
    return {
      label: "Aktif",
      className: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "SUSPENDED") {
    return {
      label: "Askıda",
      className: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: "Arşivde",
    className: "bg-slate-100 text-slate-600",
  };
}

export function getTransactionColor(type: string) {
  if (type === "INCOME" || type === "COLLECTION") {
    return "bg-emerald-50 text-emerald-600";
  }

  if (type === "EXPENSE" || type === "PAYMENT") {
    return "bg-rose-50 text-rose-500";
  }

  return "bg-blue-50 text-blue-600";
}

export function getTransactionText(type: string) {
  if (type === "INCOME") return "Gelir";
  if (type === "EXPENSE") return "Gider";
  if (type === "TRANSFER") return "Transfer";
  if (type === "COLLECTION") return "Tahsilat";
  if (type === "PAYMENT") return "Ödeme";
  return type;
}

export function buildCashBankQuery(params: {
  tab?: CashBankTabKey;
  page?: number;
  q?: string | null;
}) {
  const search = new URLSearchParams();

  if (params.tab && params.tab !== "accounts") {
    search.set("tab", params.tab);
  }

  if (params.page && params.page > 1) {
    search.set("page", String(params.page));
  }

  if (params.q) {
    search.set("q", params.q);
  }

  const query = search.toString();
  return query ? `/cash-bank?${query}` : "/cash-bank";
}

export function buildBalanceBreakdown(
  cashTotal: number,
  bankAccounts: Array<{ name: string; bankName: string | null; balance: number }>
): BalanceBreakdownItem[] {
  const items: Array<{ name: string; total: number }> = [];

  if (cashTotal > 0) {
    items.push({ name: "Kasa", total: cashTotal });
  }

  for (const account of bankAccounts) {
    if (account.balance > 0) {
      items.push({
        name: account.bankName || account.name,
        total: account.balance,
      });
    }
  }

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  return items.map((item, index) => ({
    ...item,
    percent: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
    color: BALANCE_CHART_COLORS[index % BALANCE_CHART_COLORS.length],
  }));
}
