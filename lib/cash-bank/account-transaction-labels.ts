import { getTransactionDirection } from "@/lib/cash-bank-account-utils";

export function getAccountTransactionTypeLabel(input: {
  type: string;
  title: string;
}): string {
  const title = input.title.toLocaleLowerCase("tr-TR");

  if (title.includes("iade")) return "İade";
  if (title.includes("düzeltme") || title.includes("duzeltme")) return "Düzeltme";

  if (input.type === "TRANSFER") {
    const direction = getTransactionDirection(input);
    return direction === "in" ? "Transfer Girişi" : "Transfer Çıkışı";
  }

  const labels: Record<string, string> = {
    INCOME: "Para Girişi",
    EXPENSE: "Para Çıkışı",
    COLLECTION: "Tahsilat",
    PAYMENT: "Ödeme",
    TRANSFER_IN: "Transfer Girişi",
    TRANSFER_OUT: "Transfer Çıkışı",
    REFUND: "İade",
    ADJUSTMENT: "Düzeltme",
  };

  return labels[input.type] ?? input.type;
}
