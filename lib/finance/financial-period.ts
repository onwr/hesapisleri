/**
 * Canonical period helpers for financial aggregates.
 * Company timezone defaults to Europe/Istanbul (TR tenants).
 *
 * All money ranges are half-open: [from, toExclusive).
 */

export const COMPANY_FINANCE_TIMEZONE = "Europe/Istanbul";

export const CASH_RESULT_LABEL = "Operasyonel Nakit Sonucu";
export const CASH_RESULT_TOOLTIP =
  "Seçili dönemde gerçekleşen nakit girişleri ile nakit çıkışları arasındaki farktır.";
export const ACCRUAL_PROFIT_LABEL = "Tahakkuk Kârı";
export const ACCRUAL_SALES_BY_CREATED_AT_LABEL =
  "Kayıt Oluşturma Tarihine Göre Satış";
export const ACCRUAL_SALES_BY_SALE_DATE_LABEL =
  "Satış Tarihine Göre Satış";

function toZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of `timeZone` relative to UTC at the given instant (ms). */
function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const zoned = toZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock timestamp in `timeZone` to a UTC Date.
 * Iterates twice for DST transitions.
 */
export function zonedWallTimeToUtc(
  wall: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
    second?: number;
    millisecond?: number;
  },
  timeZone = COMPANY_FINANCE_TIMEZONE
) {
  const hour = wall.hour ?? 0;
  const minute = wall.minute ?? 0;
  const second = wall.second ?? 0;
  const millisecond = wall.millisecond ?? 0;
  const utcGuess =
    Date.UTC(wall.year, wall.month - 1, wall.day, hour, minute, second, millisecond);

  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset;
  offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
  utc = utcGuess - offset;

  return new Date(utc);
}

/** Local calendar day start in company TZ (UTC instant). */
export function startOfZonedDay(date: Date, timeZone = COMPANY_FINANCE_TIMEZONE) {
  const { year, month, day } = toZonedParts(date, timeZone);
  return zonedWallTimeToUtc({ year, month, day }, timeZone);
}

export function startOfNextZonedDay(
  date: Date,
  timeZone = COMPANY_FINANCE_TIMEZONE
) {
  const start = startOfZonedDay(date, timeZone);
  // DST-safe: advance calendar day via zoned parts + 1 day wall clock
  const parts = toZonedParts(start, timeZone);
  const next = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0, 0)
  );
  const nextParts = toZonedParts(next, timeZone);
  return zonedWallTimeToUtc(
    { year: nextParts.year, month: nextParts.month, day: nextParts.day },
    timeZone
  );
}

export function startOfZonedMonth(
  date: Date,
  timeZone = COMPANY_FINANCE_TIMEZONE
) {
  const { year, month } = toZonedParts(date, timeZone);
  return zonedWallTimeToUtc({ year, month, day: 1 }, timeZone);
}

export function startOfNextZonedMonth(
  date: Date,
  timeZone = COMPANY_FINANCE_TIMEZONE
) {
  const { year, month } = toZonedParts(date, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return zonedWallTimeToUtc(
    { year: nextYear, month: nextMonth, day: 1 },
    timeZone
  );
}

/** Half-open [from, toExclusive). */
export function isInHalfOpenRange(value: Date, from: Date, toExclusive: Date) {
  const t = value.getTime();
  return t >= from.getTime() && t < toExclusive.getTime();
}

/**
 * Normalize a legacy inclusive `to` (end-of-day / end-of-month) or already-exclusive
 * upper bound into a half-open exclusive end.
 * If `to` looks like end-of-day (ms=999 or time near 23:59:59), treat as inclusive → +1ms.
 */
export function toExclusiveBound(to: Date, mode: "inclusive" | "exclusive" = "inclusive") {
  if (mode === "exclusive") return to;
  return new Date(to.getTime() + 1);
}

export type FinancialPeriod = {
  from: Date;
  /** Inclusive end for display / legacy lte callers. */
  toInclusive: Date;
  /** Exclusive upper bound for half-open ranges (preferred). */
  toExclusive: Date;
  label: string;
  timeZone: string;
};

export type ResolveMonthFinancialPeriodInput = {
  timezone?: string;
  referenceDate?: Date;
};

export function resolveMonthFinancialPeriod(
  inputOrReference?: ResolveMonthFinancialPeriodInput | Date,
  timeZoneArg = COMPANY_FINANCE_TIMEZONE
): FinancialPeriod {
  let reference = new Date();
  let timeZone = timeZoneArg;

  if (inputOrReference instanceof Date) {
    reference = inputOrReference;
  } else if (inputOrReference && typeof inputOrReference === "object") {
    reference = inputOrReference.referenceDate ?? new Date();
    timeZone = inputOrReference.timezone ?? COMPANY_FINANCE_TIMEZONE;
  }

  const from = startOfZonedMonth(reference, timeZone);
  const toExclusive = startOfNextZonedMonth(reference, timeZone);
  const toInclusive = new Date(toExclusive.getTime() - 1);
  const label = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(reference);

  return { from, toInclusive, toExclusive, label, timeZone };
}

export function resolvePreviousMonthFinancialPeriod(
  reference = new Date(),
  timeZone = COMPANY_FINANCE_TIMEZONE
): FinancialPeriod {
  const current = resolveMonthFinancialPeriod({
    referenceDate: reference,
    timezone: timeZone,
  });
  return resolveMonthFinancialPeriod({
    referenceDate: new Date(current.from.getTime() - 1),
    timezone: timeZone,
  });
}

/** Iterate month buckets covering [from, toExclusive) in company TZ. */
export function iterateZonedMonthBuckets(
  from: Date,
  toExclusive: Date,
  timeZone = COMPANY_FINANCE_TIMEZONE,
  maxMonths = 12
) {
  const buckets: Array<{
    from: Date;
    toExclusive: Date;
    label: string;
    key: string;
  }> = [];

  let cursor = startOfZonedMonth(toExclusive.getTime() > from.getTime()
    ? new Date(toExclusive.getTime() - 1)
    : from, timeZone);
  const rangeStart = startOfZonedMonth(from, timeZone);

  while (cursor.getTime() >= rangeStart.getTime() && buckets.length < maxMonths) {
    const start = cursor;
    const end = startOfNextZonedMonth(cursor, timeZone);
    const parts = toZonedParts(start, timeZone);
    buckets.unshift({
      from: start,
      toExclusive: end,
      key: `${parts.year}-${String(parts.month).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("tr-TR", {
        month: "short",
        timeZone,
      }).format(start),
    });
    cursor = resolvePreviousMonthFinancialPeriod(start, timeZone).from;
  }

  return buckets;
}

/** Daily buckets inside a month period (half-open). */
export function iterateZonedDayBuckets(
  monthFrom: Date,
  monthToExclusive: Date,
  timeZone = COMPANY_FINANCE_TIMEZONE
) {
  const buckets: Array<{ from: Date; toExclusive: Date; day: number; label: string }> =
    [];
  let cursor = startOfZonedDay(monthFrom, timeZone);
  while (cursor.getTime() < monthToExclusive.getTime()) {
    const next = startOfNextZonedDay(cursor, timeZone);
    const day = toZonedParts(cursor, timeZone).day;
    buckets.push({
      from: cursor,
      toExclusive: next,
      day,
      label: String(day),
    });
    cursor = next;
  }
  return buckets;
}

export function prismaHalfOpenCreatedAt(period: Pick<FinancialPeriod, "from" | "toExclusive">) {
  return { gte: period.from, lt: period.toExclusive };
}

export function prismaHalfOpenDate(period: Pick<FinancialPeriod, "from" | "toExclusive">) {
  return { gte: period.from, lt: period.toExclusive };
}
