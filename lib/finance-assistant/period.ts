import type { FinanceAssistantPeriod } from "@/lib/finance-assistant/commands";

const COMPANY_TIMEZONE = "Europe/Istanbul";

function toLocalMidnight(date: Date): Date {
  const str = date.toLocaleDateString("en-CA", { timeZone: COMPANY_TIMEZONE });
  return new Date(`${str}T00:00:00`);
}

function toLocalEndOfDay(date: Date): Date {
  const str = date.toLocaleDateString("en-CA", { timeZone: COMPANY_TIMEZONE });
  return new Date(`${str}T23:59:59.999`);
}

function localNow(): Date {
  return new Date();
}

export type ResolvedPeriod = {
  startDate: Date;
  endDate: Date;
  label: string;
};

export function resolvePeriod(
  period: FinanceAssistantPeriod,
  customStart?: string,
  customEnd?: string
): ResolvedPeriod {
  const now = localNow();

  if (period === "TODAY") {
    return {
      startDate: toLocalMidnight(now),
      endDate: toLocalEndOfDay(now),
      label: "Bugün",
    };
  }

  if (period === "THIS_WEEK") {
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    return {
      startDate: toLocalMidnight(monday),
      endDate: toLocalEndOfDay(now),
      label: "Bu Hafta",
    };
  }

  if (period === "THIS_MONTH") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: toLocalMidnight(start),
      endDate: toLocalEndOfDay(now),
      label: "Bu Ay",
    };
  }

  if (period === "LAST_MONTH") {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 1);
    const firstOfLastMonth = new Date(
      lastOfLastMonth.getFullYear(),
      lastOfLastMonth.getMonth(),
      1
    );
    return {
      startDate: toLocalMidnight(firstOfLastMonth),
      endDate: toLocalEndOfDay(lastOfLastMonth),
      label: "Geçen Ay",
    };
  }

  if (period === "LAST_30_DAYS") {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    return {
      startDate: toLocalMidnight(start),
      endDate: toLocalEndOfDay(now),
      label: "Son 30 Gün",
    };
  }

  if (period === "THIS_YEAR") {
    const start = new Date(now.getFullYear(), 0, 1);
    return {
      startDate: toLocalMidnight(start),
      endDate: toLocalEndOfDay(now),
      label: "Bu Yıl",
    };
  }

  if (period === "CUSTOM" && customStart && customEnd) {
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T23:59:59.999`);
    const fmt = (d: Date) =>
      d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    return {
      startDate: start,
      endDate: end,
      label: `${fmt(start)} – ${fmt(end)}`,
    };
  }

  // Fallback: this month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: toLocalMidnight(start),
    endDate: toLocalEndOfDay(now),
    label: "Bu Ay",
  };
}

export function resolveLastMonth(): ResolvedPeriod {
  return resolvePeriod("LAST_MONTH");
}
