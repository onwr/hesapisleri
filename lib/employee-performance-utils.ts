import { roundCashMoney } from "@/lib/cash-bank-account-utils";
import { calculateLeaveDays } from "@/lib/employee-utils";
import { endOfDay, startOfDay } from "@/lib/calendar-utils";

export type PerformanceDateRange = {
  from: Date;
  to: Date;
};

export type PerformanceBenchmarks = {
  maxRevenue: number;
  maxSales: number;
  maxLeaveDays: number;
};

export function normalizePerformanceDateRange(input?: {
  from?: Date | string | null;
  to?: Date | string | null;
}) {
  const now = new Date();
  const defaultFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const from = input?.from
    ? startOfDay(new Date(input.from))
    : defaultFrom;
  const to = input?.to ? endOfDay(new Date(input.to)) : defaultTo;

  if (from.getTime() > to.getTime()) {
    return {
      ok: false as const,
      message: "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
    };
  }

  return { ok: true as const, from, to };
}

export function getPreviousPeriodRange(range: PerformanceDateRange): PerformanceDateRange {
  const durationMs = range.to.getTime() - range.from.getTime() + 1;
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - durationMs + 1);

  return {
    from: startOfDay(previousFrom),
    to: endOfDay(previousTo),
  };
}

export function normalizeMetric(value: number, max: number) {
  if (max <= 0) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value / max));
}

export function calculateAverageTicket(revenue: number, salesCount: number) {
  if (salesCount <= 0) return 0;
  return roundCashMoney(revenue / salesCount);
}

export function calculateRevenuePerPayrollCost(revenue: number, payrollCost: number) {
  if (payrollCost <= 0) return revenue > 0 ? null : 0;
  return roundCashMoney(revenue / payrollCost);
}

export function calculateLeaveDaysInPeriod(
  leaves: Array<{ startAt: Date; endAt: Date; status: string }>,
  from: Date,
  to: Date
) {
  return leaves.reduce((sum, leave) => {
    if (leave.status !== "APPROVED") return sum;

    const overlapStart = leave.startAt > from ? leave.startAt : from;
    const overlapEnd = leave.endAt < to ? leave.endAt : to;

    if (overlapStart.getTime() > overlapEnd.getTime()) return sum;

    return sum + calculateLeaveDays(overlapStart, overlapEnd);
  }, 0);
}

export function calculatePayrollCostInPeriod(
  payments: Array<{
    amount: number | { toString(): string };
    status: string;
    type: string;
    paidAt: Date | null;
    dueDate: Date | null;
  }>,
  from: Date,
  to: Date
) {
  let paidCost = 0;
  let pendingCost = 0;

  for (const payment of payments) {
    if (payment.type === "DEDUCTION") continue;

    const amount = Number(payment.amount);

    if (payment.status === "PAID" && payment.paidAt) {
      if (payment.paidAt >= from && payment.paidAt <= to) {
        paidCost += amount;
      }
      continue;
    }

    if (
      (payment.status === "PENDING" || payment.status === "OVERDUE") &&
      payment.dueDate &&
      payment.dueDate >= from &&
      payment.dueDate <= to
    ) {
      pendingCost += amount;
    }
  }

  return {
    payrollCost: roundCashMoney(paidCost),
    pendingPayrollCost: roundCashMoney(pendingCost),
  };
}

export function calculatePerformanceScore(input: {
  revenue: number;
  salesCount: number;
  leaveDays: number;
  payrollCost: number;
  benchmarks: PerformanceBenchmarks;
}) {
  const revenueNorm = normalizeMetric(input.revenue, input.benchmarks.maxRevenue);
  const salesNorm = normalizeMetric(input.salesCount, input.benchmarks.maxSales);
  const leavePenalty = normalizeMetric(
    input.leaveDays,
    Math.max(input.benchmarks.maxLeaveDays, 1)
  );
  const efficiency =
    input.payrollCost > 0
      ? Math.min(input.revenue / input.payrollCost / 5, 1)
      : input.revenue > 0
        ? 0.5
        : 0;
  const attendance = Math.max(0, 1 - leavePenalty);

  const score =
    revenueNorm * 35 +
    salesNorm * 25 +
    efficiency * 25 +
    attendance * 15;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return roundCashMoney(((current - previous) / previous) * 100);
}

export function parsePerformanceDepartment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function parsePerformanceEmployeeId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function buildPersonnelPerformanceCsvRow(values: string[]) {
  return values
    .map((cell) => {
      if (/[",\n]/.test(cell)) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    })
    .join(",");
}
