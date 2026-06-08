import { formatMoney } from "@/lib/format-utils";

export { formatMoney };

export function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function startOfYesterday(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - 1);
  return d;
}

export function endOfYesterday(date: Date) {
  const d = startOfDay(date);
  d.setMilliseconds(-1);
  return d;
}

export function startOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

export function endOfLastMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
}

export function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function sumSalesTotal(
  sales: Array<{ total: unknown; createdAt: Date }>
) {
  return sales.reduce((sum, sale) => sum + Number(sale.total), 0);
}

export function sumExpensesAmount(
  expenses: Array<{ amount: unknown; date: Date }>
) {
  return expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
}

export function buildDailySalesChart(
  sales: Array<{ total: unknown; createdAt: Date }>,
  monthStart: Date
) {
  const daysInMonth = endOfMonth(monthStart).getDate();
  const dailyMap = new Map<number, number>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    dailyMap.set(day, 0);
  }

  for (const sale of sales) {
    const day = sale.createdAt.getDate();
    dailyMap.set(day, (dailyMap.get(day) || 0) + Number(sale.total));
  }

  return Array.from(dailyMap.entries()).map(([day, amount]) => ({
    day: String(day),
    amount,
    label: `${day}`,
  }));
}

export function getActivityTag(module: string) {
  if (module === "sales" || module === "pos") {
    return { label: "Satış", color: "green" as const };
  }

  if (module === "e-invoice" || module === "invoices") {
    return { label: "Fatura", color: "blue" as const };
  }

  if (module === "expenses") {
    return { label: "Gider", color: "orange" as const };
  }

  if (module === "cash-bank") {
    return { label: "Tahsilat", color: "purple" as const };
  }

  return { label: "İşlem", color: "slate" as const };
}

export function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Az önce";
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function buildAiInsight(
  monthSales: number,
  lastMonthSales: number,
  monthExpenses: number,
  lastMonthExpenses: number,
  pendingCollection: number
) {
  const expenseChange = percentChange(monthExpenses, lastMonthExpenses);
  const salesChange = percentChange(monthSales, lastMonthSales);

  if (expenseChange > 10) {
    return `Bu ay giderlerin geçen aya göre %${expenseChange} arttı. Harcama kalemlerini gözden geçirmeniz faydalı olabilir.`;
  }

  if (salesChange > 10) {
    return `Bu ay satış performansınız geçen aya göre %${salesChange} yükseldi. Bu ivmeyi korumak için stok ve tahsilat takibine devam edin.`;
  }

  if (pendingCollection > 0) {
    return `Tahsilat bekleyen ${formatMoney(pendingCollection)} tutarında kaydınız var. Nakit akışını güçlendirmek için vadesi gelenleri önceliklendirin.`;
  }

  return "İşletmenizin genel görünümü dengeli. Hızlı işlem butonlarıyla satış, fatura ve tahsilat süreçlerinizi tek ekrandan yönetebilirsiniz.";
}
