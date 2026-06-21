import "server-only";

export type CurrencyCode = "TRY" | string;

const MONEY_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

export function normalizeCurrency(currency: string | null | undefined): CurrencyCode {
  const value = (currency ?? "TRY").trim().toUpperCase();
  if (value === "TL") return "TRY";
  return value || "TRY";
}

export function assertPositiveMinorAmount(amountMinor: number) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Ödeme tutarı pozitif kuruş değeri olmalıdır.");
  }
}

export function decimalToMinor(input: number | string): number {
  const raw = String(input).trim().replace(",", ".");
  if (!MONEY_PATTERN.test(raw)) {
    throw new Error("Geçersiz ödeme tutarı.");
  }

  const [whole, fraction = ""] = raw.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  assertPositiveMinorAmount(minor);
  return minor;
}

export function minorToDecimal(amountMinor: number): string {
  assertPositiveMinorAmount(amountMinor);
  return (amountMinor / 100).toFixed(2);
}

export function formatPaytrDecimalAmount(amountMinor: number): string {
  return minorToDecimal(amountMinor);
}

export function formatPaytrMinorAmount(amountMinor: number): string {
  assertPositiveMinorAmount(amountMinor);
  return String(amountMinor);
}

export function parsePaytrMinorAmount(input: string | number): number {
  const value = Number(input);
  assertPositiveMinorAmount(value);
  return value;
}

export function parsePaytrDecimalAmount(input: string | number): number {
  return decimalToMinor(input);
}

export function calculateVatMinor(subtotalMinor: number, vatRate: number) {
  assertPositiveMinorAmount(subtotalMinor);
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new Error("KDV oranı geçersiz.");
  }
  return Math.round((subtotalMinor * vatRate) / 100);
}
