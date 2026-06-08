import { endOfMonth, startOfMonth } from "@/lib/dashboard-metrics";
import { getTransactionText } from "@/lib/cash-bank-page-utils";

export type AccountTransactionDirection = "in" | "out";

export type AccountTransactionSourceKey =
  | "sale"
  | "collection"
  | "manual"
  | "cancel"
  | "expense"
  | "transfer";

export type AccountTransactionLike = {
  id: string;
  date: Date;
  createdAt: Date;
  title: string;
  note?: string | null;
  amount: number;
  type: string;
  expenseId?: string | null;
};

export function roundCashMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getTransactionDirection(
  transaction: Pick<AccountTransactionLike, "type" | "title">
): AccountTransactionDirection {
  if (transaction.type === "EXPENSE" || transaction.type === "PAYMENT") {
    return "out";
  }

  if (transaction.type === "INCOME" || transaction.type === "COLLECTION") {
    return "in";
  }

  if (transaction.type === "TRANSFER") {
    const title = transaction.title.toLocaleLowerCase("tr-TR");
    if (title.includes("çıkış") || title.includes("cikis")) {
      return "out";
    }
    return "in";
  }

  return "in";
}

export function getTransactionSignedAmount(
  transaction: Pick<AccountTransactionLike, "type" | "title" | "amount">
) {
  const direction = getTransactionDirection(transaction);
  return direction === "out"
    ? -roundCashMoney(transaction.amount)
    : roundCashMoney(transaction.amount);
}

export function inferTransactionSource(
  transaction: Pick<AccountTransactionLike, "type" | "title" | "note">
): { key: AccountTransactionSourceKey; label: string } {
  const title = transaction.title.toLocaleLowerCase("tr-TR");
  const note = transaction.note?.toLocaleLowerCase("tr-TR") ?? "";

  if (title.includes("iptal")) {
    return { key: "cancel", label: "İptal" };
  }

  if (title.includes("transfer")) {
    return { key: "transfer", label: "Transfer" };
  }

  if (
    title.includes("satış tahsilat") ||
    title.includes("satis tahsilat") ||
    transaction.type === "COLLECTION"
  ) {
    return { key: "collection", label: "Tahsilat" };
  }

  if (title.includes("satış") || title.includes("satis")) {
    return { key: "sale", label: "Satış" };
  }

  if (title.includes("gider") || note.includes("gider")) {
    return { key: "expense", label: "Gider" };
  }

  if (transaction.type === "PAYMENT") {
    return { key: "expense", label: "Gider" };
  }

  return { key: "manual", label: "Manuel" };
}

export function extractTransactionReference(
  title: string,
  note?: string | null
) {
  const combined = `${title} ${note ?? ""}`;
  const saleMatch = combined.match(/([A-Z]{2,}[-\s]?\d{3,})/);
  if (saleMatch) {
    return saleMatch[1]?.replace(/\s+/g, "-") ?? null;
  }

  const dashPart = title.split(" - ").pop();
  if (dashPart && dashPart !== title && dashPart.length <= 40) {
    return dashPart;
  }

  return null;
}

export function attachRunningBalances<T extends AccountTransactionLike>(
  transactions: T[],
  currentBalance: number
) {
  const sorted = [...transactions].sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const totalDelta = sorted.reduce(
    (sum, transaction) => sum + getTransactionSignedAmount(transaction),
    0
  );

  let running = roundCashMoney(currentBalance - totalDelta);
  const balanceMap = new Map<string, number>();

  for (const transaction of sorted) {
    running = roundCashMoney(
      running + getTransactionSignedAmount(transaction)
    );
    balanceMap.set(transaction.id, running);
  }

  return transactions.map((transaction) => ({
    ...transaction,
    balanceAfter: balanceMap.get(transaction.id) ?? currentBalance,
  }));
}

export function computeAccountMetrics(
  transactions: AccountTransactionLike[],
  currentBalance: number,
  now = new Date()
) {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let totalIn = 0;
  let totalOut = 0;
  let monthIn = 0;
  let monthOut = 0;

  for (const transaction of transactions) {
    const signed = getTransactionSignedAmount(transaction);
    const inMonth =
      transaction.date >= monthStart && transaction.date <= monthEnd;

    if (signed >= 0) {
      totalIn += signed;
      if (inMonth) monthIn += signed;
    } else {
      totalOut += Math.abs(signed);
      if (inMonth) monthOut += Math.abs(signed);
    }
  }

  return {
    currentBalance: roundCashMoney(currentBalance),
    totalIn: roundCashMoney(totalIn),
    totalOut: roundCashMoney(totalOut),
    monthIn: roundCashMoney(monthIn),
    monthOut: roundCashMoney(monthOut),
  };
}

export function validateTransferAccounts(
  fromAccountId: string,
  toAccountId: string,
  amount: number
) {
  if (fromAccountId === toAccountId) {
    return "Kaynak ve hedef hesap aynı olamaz.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Transfer tutarı 0'dan büyük olmalıdır.";
  }

  return null;
}

export function buildAccountTransactionsCsv(
  transactions: Array<
    AccountTransactionLike & {
      balanceAfter: number;
    }
  >
) {
  const header = ["Tarih", "Başlık", "Not", "Tutar", "Tip", "Bakiye"];

  const rows = transactions.map((transaction) => {
    const direction = getTransactionDirection(transaction);
    const signed = getTransactionSignedAmount(transaction);
    const typeLabel = `${getTransactionText(transaction.type)} (${direction === "in" ? "Giriş" : "Çıkış"})`;

    return [
      new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(transaction.date),
      transaction.title,
      transaction.note ?? "",
      signed.toFixed(2),
      typeLabel,
      transaction.balanceAfter.toFixed(2),
    ];
  });

  return [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          if (/[",\n]/.test(cell)) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    )
    .join("\n");
}

export function toDateTimeLocalValue(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function sanitizeAccountExportFilename(name: string) {
  const sanitized = name
    .trim()
    .replace(/[^\w\s-ğüşıöçĞÜŞİÖÇ]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

  return sanitized || "hesap-hareketleri";
}

export function parseMovementDate(value?: string | null) {
  if (!value?.trim()) {
    return new Date();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}
