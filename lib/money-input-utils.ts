export const PRODUCT_MONEY_MIN = 0;

export function parseTurkishMoneyInput(value: string): number {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return 0;

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed;

  if (hasComma && hasDot) {
    const lastComma = trimmed.lastIndexOf(",");
    const lastDot = trimmed.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = trimmed.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value)) return "";

  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function normalizeMoneyInput(value: string): string {
  const parsed = parseTurkishMoneyInput(value);
  if (!Number.isFinite(parsed)) return value.trim();
  return formatMoneyInput(parsed);
}

export function isValidMoneyInput(
  value: string,
  options?: { allowNegative?: boolean; allowEmpty?: boolean }
) {
  const trimmed = value.trim();
  if (!trimmed) return options?.allowEmpty ?? false;

  const parsed = parseTurkishMoneyInput(trimmed);
  if (!Number.isFinite(parsed)) return false;

  if (!options?.allowNegative && parsed < 0) return false;

  return true;
}

export function isValidProductMoneyInput(value: string) {
  return isValidMoneyInput(value, { allowEmpty: true }) &&
    parseTurkishMoneyInput(value) >= PRODUCT_MONEY_MIN;
}

export function parseProductMoneyInput(value: string): number {
  const parsed = parseTurkishMoneyInput(value);
  if (!Number.isFinite(parsed) || parsed < PRODUCT_MONEY_MIN) {
    return PRODUCT_MONEY_MIN;
  }
  return parsed;
}

/** @deprecated use parseTurkishMoneyInput */
export const parseTurkishDecimalInput = parseTurkishMoneyInput;

/** @deprecated use formatMoneyInput */
export const formatDecimalInputValue = formatMoneyInput;
