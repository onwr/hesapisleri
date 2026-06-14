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
