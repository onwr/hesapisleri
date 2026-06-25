import type { Decimal } from "@prisma/client/runtime/library";

/**
 * Prisma Decimal → UBL XML decimal string (ör. 123.45).
 */
export function decimalToXmlAmount(value: Decimal | string | number): string {
  if (value && typeof value === "object" && "toFixed" in value) {
    const text = (value as Decimal).toFixed(2);
    if (text.includes("e") || text.includes("E")) {
      throw new Error("Scientific notation desteklenmiyor.");
    }
    return text;
  }

  const raw = String(value ?? "0").trim().replace(",", ".");
  if (raw.includes("e") || raw.includes("E")) {
    throw new Error("Scientific notation desteklenmiyor.");
  }
  if (!/^-?\d+(?:\.\d{1,8})?$/.test(raw)) {
    throw new Error(`Geçersiz decimal değer: ${raw}`);
  }

  const negative = raw.startsWith("-");
  const normalized = negative ? raw.slice(1) : raw;
  const [whole, fraction = ""] = normalized.split(".");
  const padded = fraction.padEnd(2, "0").slice(0, 8);
  const trimmed = padded.replace(/0+$/, "");
  const result =
    trimmed.length >= 2
      ? `${whole}.${trimmed}`
      : `${whole}.${padded.slice(0, 2)}`;
  return negative ? `-${result}` : result;
}

export function quantityToXml(value: Decimal | string | number): string {
  return decimalToXmlAmount(value);
}

/** KDV oranı — GİB örneklerinde tam sayı (ör. 18, 20). */
export function formatXmlPercent(value: Decimal | string | number): string {
  const text = decimalToXmlAmount(value);
  if (text.endsWith(".00")) return text.slice(0, -3);
  if (text.endsWith("0") && text.includes(".")) {
    return text.replace(/0+$/, "").replace(/\.$/, "");
  }
  return text;
}
