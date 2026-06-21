import type { Decimal } from "@prisma/client/runtime/library";

const MONEY_PATTERN = /^-?\d+(?:[.,]\d{1,2})?$/;

function normalizeMoneyText(value: Decimal | number | string): string {
  if (value && typeof value === "object" && "toFixed" in value) {
    return (value as Decimal).toFixed(2);
  }

  const raw = String(value ?? "0").trim().replace(",", ".");
  if (MONEY_PATTERN.test(raw)) {
    const [whole, fraction = ""] = raw.split(".");
    return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Geçersiz tutar değeri.");
  }
  return parsed.toFixed(2);
}

/** Fatura snapshot tutarını kuruş (int64-safe) değerine çevirir; float yeniden hesaplama yapmaz. */
export function invoiceMoneyToMinor(value: Decimal | number | string): number {
  const text = normalizeMoneyText(value);
  const negative = text.startsWith("-");
  const normalized = negative ? text.slice(1) : text;
  const [whole, fraction = "00"] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

  if (!Number.isSafeInteger(minor)) {
    throw new Error("Tutar çok büyük.");
  }

  return negative ? -minor : minor;
}

export function assertPositiveInvoiceMinor(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Tutar pozitif kuruş değeri olmalıdır.");
  }
}

export function quantityToProviderValue(value: Decimal | number | string): number {
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as Decimal).toNumber();
  }
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Geçersiz miktar.");
  }
  return parsed;
}
