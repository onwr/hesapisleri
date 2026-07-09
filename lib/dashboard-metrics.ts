import { formatMoney } from "@/lib/format-utils";
import {
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  iterateZonedDayBuckets,
} from "@/lib/finance/financial-period";

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
  monthStart: Date,
  monthToExclusive?: Date
) {
  if (monthToExclusive) {
    const buckets = iterateZonedDayBuckets(
      monthStart,
      monthToExclusive,
      COMPANY_FINANCE_TIMEZONE
    );

    return buckets.map((bucket) => {
      const amount = sales
        .filter((sale) =>
          isInHalfOpenRange(sale.createdAt, bucket.from, bucket.toExclusive)
        )
        .reduce((sum, sale) => sum + Number(sale.total), 0);

      return {
        day: String(bucket.day),
        amount,
        label: bucket.label,
      };
    });
  }

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

export function getActivityTag(
  module: string,
  action?: string,
  options?: { isTransfer?: boolean }
) {
  if (
    options?.isTransfer ||
    action === "TRANSFER" ||
    (action === "transfer" && (module === "cash-bank" || module === "cash_bank"))
  ) {
    return { label: "Transfer", color: "blue" as const };
  }

  if (module === "sales" || module === "pos") {
    return { label: "Satış", color: "green" as const };
  }

  if (module === "e-invoice" || module === "invoices") {
    return { label: "Fatura", color: "blue" as const };
  }

  if (module === "expenses") {
    return { label: "Gider", color: "orange" as const };
  }

  if (module === "products") {
    return { label: "Ürün", color: "green" as const };
  }

  if (module === "stocks") {
    return { label: "Stok", color: "orange" as const };
  }

  if (module === "orders") {
    return { label: "Sipariş", color: "blue" as const };
  }

  if (module === "customers") {
    return { label: "Müşteri", color: "purple" as const };
  }

  if (module === "suppliers") {
    return { label: "Tedarikçi", color: "purple" as const };
  }

  if (module === "cash-bank" || module === "cash_bank") {
    if (action === "COLLECT") {
      return { label: "Tahsilat", color: "purple" as const };
    }

    if (action === "PAY") {
      return { label: "Ödeme", color: "orange" as const };
    }

    return { label: "Kasa/Banka", color: "blue" as const };
  }

  if (module === "team" || module === "settings" || module === "employees") {
    return { label: "Ekip", color: "purple" as const };
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

export function buildDashboardAiInsights(
  monthSales: number,
  lastMonthSales: number,
  monthExpenses: number,
  lastMonthExpenses: number,
  pendingCollection: number
) {
  const insights: string[] = [];
  const expenseChange = percentChange(monthExpenses, lastMonthExpenses);
  const salesChange = percentChange(monthSales, lastMonthSales);

  if (expenseChange > 10) {
    insights.push(
      `Bu ay giderlerin geçen aya göre %${expenseChange} arttı. Harcama kalemlerini gözden geçirmeniz faydalı olabilir.`
    );
  }

  if (salesChange > 10) {
    insights.push(
      `Bu ay satış performansınız geçen aya göre %${salesChange} yükseldi. Bu ivmeyi korumak için stok ve tahsilat takibine devam edin.`
    );
  }

  if (salesChange < -10) {
    insights.push(
      `Bu ay satışlar geçen aya göre %${Math.abs(salesChange)} geriledi. Kampanya ve tahsilat aksiyonlarını değerlendirebilirsiniz.`
    );
  }

  if (pendingCollection > 0) {
    insights.push(
      `Tahsilat bekleyen ${formatMoney(pendingCollection)} tutarında kaydınız var. Nakit akışını güçlendirmek için vadesi gelenleri önceliklendirin.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      "İşletmenizin genel görünümü dengeli. Hızlı işlem butonlarıyla satış, fatura ve tahsilat süreçlerinizi tek ekrandan yönetebilirsiniz."
    );
  }

  return insights.slice(0, 5);
}

export function buildAiInsight(
  monthSales: number,
  lastMonthSales: number,
  monthExpenses: number,
  lastMonthExpenses: number,
  pendingCollection: number
) {
  return buildDashboardAiInsights(
    monthSales,
    lastMonthSales,
    monthExpenses,
    lastMonthExpenses,
    pendingCollection
  )[0];
}
