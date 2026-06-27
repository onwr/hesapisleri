import {
  endOfLastMonth,
  endOfMonth,
  startOfDay,
  startOfLastMonth,
  startOfMonth,
} from "@/lib/dashboard-metrics";
import { normalizeDateRange, parseDateParam } from "@/lib/sales-page-utils";

export const ADMIN_OVERVIEW_RANGE_KEYS = [
  "today",
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "custom",
] as const;

export type AdminOverviewRangeKey = (typeof ADMIN_OVERVIEW_RANGE_KEYS)[number];

export type AdminOverviewPeriod = {
  key: AdminOverviewRangeKey;
  from: Date;
  to: Date;
  comparisonFrom: Date;
  comparisonTo: Date;
  label: string;
  timezone: string;
};

export type AdminOverviewQuery = {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  timezone?: string | null;
};

const DEFAULT_TIMEZONE = "Europe/Istanbul";

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildComparisonPeriod(from: Date, to: Date) {
  const durationMs = to.getTime() - from.getTime();
  const comparisonTo = new Date(from.getTime() - 1);
  const comparisonFrom = new Date(comparisonTo.getTime() - durationMs);
  return { comparisonFrom, comparisonTo };
}

export function resolveAdminOverviewPeriod(
  input: AdminOverviewQuery,
  now = new Date()
): AdminOverviewPeriod {
  const timezone = input.timezone?.trim() || DEFAULT_TIMEZONE;
  const rangeInput = input.range?.trim().toLowerCase() ?? "30d";

  let key: AdminOverviewRangeKey = "30d";
  let from: Date;
  let to: Date;
  let label: string;

  if (rangeInput === "custom" || (input.from && input.to)) {
    const parsedFrom = parseDateParam(input.from ?? undefined) ?? startOfMonth(now);
    const parsedTo = parseDateParam(input.to ?? undefined) ?? endOfMonth(now);
    const normalized = normalizeDateRange(parsedFrom, parsedTo);
    key = "custom";
    from = startOfDay(normalized.from);
    to = endOfDay(normalized.to);
    label = "Özel aralık";
  } else if (rangeInput === "today") {
    key = "today";
    from = startOfDay(now);
    to = endOfDay(now);
    label = "Bugün";
  } else if (rangeInput === "7d") {
    key = "7d";
    from = startOfDay(shiftDays(now, -6));
    to = endOfDay(now);
    label = "Son 7 gün";
  } else if (rangeInput === "90d") {
    key = "90d";
    from = startOfDay(shiftDays(now, -89));
    to = endOfDay(now);
    label = "Son 90 gün";
  } else if (rangeInput === "this_month") {
    key = "this_month";
    from = startOfMonth(now);
    to = endOfMonth(now);
    label = "Bu ay";
  } else if (rangeInput === "last_month") {
    key = "last_month";
    from = startOfLastMonth(now);
    to = endOfLastMonth(now);
    label = "Geçen ay";
  } else {
    key = "30d";
    from = startOfDay(shiftDays(now, -29));
    to = endOfDay(now);
    label = "Son 30 gün";
  }

  const { comparisonFrom, comparisonTo } = buildComparisonPeriod(from, to);

  return {
    key,
    from,
    to,
    comparisonFrom,
    comparisonTo,
    label,
    timezone,
  };
}

export function buildAdminOverviewSearchParams(period: AdminOverviewPeriod) {
  if (period.key === "custom") {
    const from = period.from.toISOString().slice(0, 10);
    const to = period.to.toISOString().slice(0, 10);
    return `range=custom&from=${from}&to=${to}`;
  }

  const rangeMap: Record<Exclude<AdminOverviewRangeKey, "custom">, string> = {
    today: "today",
    "7d": "7d",
    "30d": "30d",
    "90d": "90d",
    this_month: "this_month",
    last_month: "last_month",
  };

  return `range=${rangeMap[period.key as Exclude<AdminOverviewRangeKey, "custom">]}`;
}

export function buildAdminOverviewCacheKey(query: AdminOverviewQuery) {
  const period = resolveAdminOverviewPeriod(query);
  return [
    period.key,
    period.from.toISOString(),
    period.to.toISOString(),
    period.timezone,
  ].join(":");
}
