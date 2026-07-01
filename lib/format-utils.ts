export function formatMoney(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "₺0,00";
  }

  const absFormatted = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numericValue));

  return numericValue < 0 ? `-${absFormatted}` : absFormatted;
}

export function formatNumber(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0";
  }

  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(numericValue);
}

export function toIsoString(
  value: Date | string | number | null | undefined
): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function coerceValidDate(
  value: Date | string | number | null | undefined
): Date | null {
  const iso = toIsoString(value);
  if (!iso) return null;
  return new Date(iso);
}

export function getTimeMs(
  value: Date | string | number | null | undefined
): number | null {
  const date = coerceValidDate(value);
  return date ? date.getTime() : null;
}

export function formatDisplayDate(
  value: Date | string | number | null | undefined,
  fallback = "—"
): string {
  const date = coerceValidDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPercent(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "%0,00";
  }

  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numericValue));

  const prefix = numericValue < 0 ? "-%" : "%";
  return `${prefix}${formatted}`;
}

export {
  formatDecimalInputValue,
  formatMoneyInput,
  isValidProductMoneyInput,
  normalizeMoneyInput,
  parseProductMoneyInput,
  parseTurkishDecimalInput,
  parseTurkishMoneyInput,
} from "@/lib/money-input-utils";
