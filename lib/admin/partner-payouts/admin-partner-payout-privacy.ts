import { redactValueRecursive } from "@/lib/admin/plans/admin-plan-activity-scope";

export function maskIban(iban: string | null | undefined): string | null {
  if (!iban?.trim()) return null;
  const cleaned = iban.replace(/\s/g, "");
  if (cleaned.length <= 8) return "****";
  return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
}

export function maskPaymentReference(ref: string | null | undefined): string | null {
  if (!ref?.trim()) return null;
  const cleaned = ref.trim();
  if (cleaned.length <= 4) return "****";
  return `${cleaned.slice(0, 2)}****${cleaned.slice(-2)}`;
}

export function redactPayoutRow<T>(row: T): T {
  return redactValueRecursive(row) as T;
}
