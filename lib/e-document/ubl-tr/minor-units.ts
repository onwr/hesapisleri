import { invoiceMoneyToMinor } from "@/lib/efaturam/efaturam-money";
import { decimalToXmlAmount } from "@/lib/e-document/ubl-tr/decimal-format";

export function xmlAmountToMinor(value: string): number {
  return invoiceMoneyToMinor(value);
}

export function minorUnitsToXmlAmount(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  const text = `${whole}.${fraction.toString().padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

export function sumXmlAmounts(values: string[]): number {
  return values.reduce((sum, value) => sum + xmlAmountToMinor(value), 0);
}

export function sumDecimalFields(
  values: Array<string | number | { toFixed: (digits: number) => string }>
): number {
  let sum = 0;
  for (const value of values) {
    sum += invoiceMoneyToMinor(value as never);
  }
  return sum;
}

export function decimalFieldToXml(
  value: { toFixed?: (digits: number) => string } | string | number
): string {
  return decimalToXmlAmount(value as never);
}
