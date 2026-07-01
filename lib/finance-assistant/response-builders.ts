import type { ResolvedPeriod } from "@/lib/finance-assistant/period";

export type FinanceMetric = {
  label: string;
  value: number | string;
  formattedValue: string;
  currency?: string;
};

export type FinanceResultItem = {
  id?: string;
  label: string;
  value: number | string;
  formattedValue: string;
  unit?: string;
  secondary?: string;
};

export type FinanceAssistantResult = {
  command: string;
  title: string;
  message: string;
  metrics: FinanceMetric[];
  items: FinanceResultItem[];
  period: {
    label: string;
    startDate: string;
    endDate: string;
  };
};

const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number, currency = "TRY"): string {
  if (currency === "TRY") return TRY_FORMATTER.format(amount);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatQuantity(qty: number, unit: string): string {
  const unitLabel = UNIT_LABELS[unit] ?? unit;
  return `${qty.toLocaleString("tr-TR")} ${unitLabel}`;
}

const UNIT_LABELS: Record<string, string> = {
  PIECE: "adet",
  KG: "kg",
  METER: "m",
  LITER: "litre",
  PACK: "paket",
  HOUR: "saat",
  DAY: "gün",
  JOB: "iş",
};

export function buildPeriodResult(period: ResolvedPeriod) {
  return {
    label: period.label,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
  };
}

export function groupByCurrency<T extends { currency: string; amount: number }>(
  rows: T[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.currency] = (map[row.currency] ?? 0) + row.amount;
  }
  return map;
}

export function formatCurrencyGroup(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return formatMoney(0);
  return entries.map(([cur, val]) => formatMoney(val, cur)).join(" + ");
}
