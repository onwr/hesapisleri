import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";

export function maskIban(iban: string | null | undefined): string | null {
  if (!iban?.trim()) return null;
  const cleaned = iban.replace(/\s/g, "");
  if (cleaned.length <= 8) return "****";
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
}

export function maskTaxNumber(tax: string | null | undefined): string | null {
  if (!tax?.trim()) return null;
  if (tax.length <= 4) return "****";
  return `${tax.slice(0, 2)}****${tax.slice(-2)}`;
}

export function redactApplicationRow<T>(row: T): T {
  return redactValueRecursive(row) as T;
}
