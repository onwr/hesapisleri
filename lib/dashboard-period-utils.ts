import { formatDateInputValue } from "@/lib/sales-page-utils";

export type DashboardPeriodKey = `${number}-${string}-${string}`;

export function resolveDashboardPeriodKey(referenceDate = new Date()): string {
  return formatDateInputValue(referenceDate);
}

export function resolveDashboardReferenceDate(periodKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
  if (!match) {
    return new Date();
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return new Date();
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function buildDashboardCacheKeyParts(input: {
  companyId: string;
  periodKey: string;
  scope?: string;
}) {
  return [
    "dashboard-page-data",
    input.companyId,
    input.periodKey,
    input.scope ?? "v2",
  ] as const;
}

export function getDashboardScopedCacheTag(input: {
  companyId: string;
  periodKey: string;
  scope?: string;
}) {
  return `dashboard:${input.companyId}:${input.periodKey}:${input.scope ?? "default"}`;
}
