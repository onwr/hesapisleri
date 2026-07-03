import "server-only";

import { runFinanceCommand } from "@/lib/finance-assistant/service";
import type { FinanceAssistantPeriod } from "@/lib/finance-assistant/commands";

const CATEGORY_COMMANDS: Record<string, Array<{ command: Parameters<typeof runFinanceCommand>[1]["command"]; period?: FinanceAssistantPeriod }>> = {
  Satış: [
    { command: "SALES_COMPARISON" },
    { command: "TOTAL_SALES" },
    { command: "TOP_SELLING_PRODUCTS" },
  ],
  Finans: [
    { command: "NET_RESULT" },
    { command: "TOTAL_EXPENSE" },
    { command: "CASH_BANK_BALANCE" },
    { command: "CUSTOMER_RECEIVABLES" },
  ],
  Stok: [{ command: "LOW_STOCK_PRODUCTS" }],
  Ürün: [
    { command: "TOP_REVENUE_PRODUCTS" },
    { command: "TOP_PROFIT_PRODUCTS" },
  ],
};

export async function buildFinanceCategorySuggestions(
  companyId: string,
  category: string
): Promise<string[]> {
  const commands = CATEGORY_COMMANDS[category];
  if (!commands?.length) {
    return ["Bu kategori için öneri hazırlanıyor."];
  }

  const suggestions: string[] = [];

  for (const entry of commands) {
    try {
      const result = await runFinanceCommand(companyId, {
        command: entry.command,
        period: entry.period ?? "THIS_MONTH",
      });
      if (result.message?.trim()) {
        suggestions.push(result.message.trim());
      }
    } catch {
      // Tek bozuk komut tüm listeyi düşürmemeli.
    }
  }

  if (suggestions.length === 0) {
    return ["Bu dönem için henüz yeterli veri yok."];
  }

  return suggestions.slice(0, 4);
}
