import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCRUAL_PROFIT_LABEL,
  CASH_RESULT_LABEL,
  CASH_RESULT_TOOLTIP,
  COMPANY_FINANCE_TIMEZONE,
  isInHalfOpenRange,
  iterateZonedDayBuckets,
  resolveMonthFinancialPeriod,
  startOfNextZonedMonth,
  startOfZonedMonth,
  zonedWallTimeToUtc,
} from "./financial-period";
import { buildCanonicalFinancialSummary } from "./financial-summary-service";
import { buildDailySalesChart } from "@/lib/dashboard-metrics";
import { buildMonthlyCashFlowData } from "@/lib/finance-aggregation-utils";

describe("financial-period Istanbul half-open", () => {
  it("resolves July 2026 month start as Europe/Istanbul midnight (UTC previous evening)", () => {
    const period = resolveMonthFinancialPeriod({
      referenceDate: new Date("2026-07-15T12:00:00+03:00"),
      timezone: COMPANY_FINANCE_TIMEZONE,
    });

    // 2026-07-01 00:00 Istanbul = 2026-06-30 21:00 UTC
    assert.equal(period.from.toISOString(), "2026-06-30T21:00:00.000Z");
    assert.equal(period.toExclusive.toISOString(), "2026-07-31T21:00:00.000Z");
    assert.equal(period.toInclusive.getTime(), period.toExclusive.getTime() - 1);
    assert.ok(period.label.toLocaleLowerCase("tr-TR").includes("temmuz"));
  });

  it("includes previous-day 21:00 UTC in July and excludes Aug 1 Istanbul midnight", () => {
    const period = resolveMonthFinancialPeriod({
      referenceDate: new Date("2026-07-08T10:00:00+03:00"),
      timezone: "Europe/Istanbul",
    });

    const julyStartUtc = new Date("2026-06-30T21:00:00.000Z");
    const lastMs = new Date(period.toExclusive.getTime() - 1);
    const nextMonthStart = new Date("2026-07-31T21:00:00.000Z");

    assert.equal(isInHalfOpenRange(julyStartUtc, period.from, period.toExclusive), true);
    assert.equal(isInHalfOpenRange(lastMs, period.from, period.toExclusive), true);
    assert.equal(
      isInHalfOpenRange(nextMonthStart, period.from, period.toExclusive),
      false
    );
  });

  it("day buckets cover month without gaps", () => {
    const period = resolveMonthFinancialPeriod({
      referenceDate: new Date("2026-07-01T12:00:00+03:00"),
    });
    const days = iterateZonedDayBuckets(
      period.from,
      period.toExclusive,
      COMPANY_FINANCE_TIMEZONE
    );
    assert.equal(days.length, 31);
    assert.equal(days[0]?.day, 1);
    assert.equal(days[30]?.day, 31);
  });
});

describe("canonical labels", () => {
  it("cash result is Operasyonel Nakit Sonucu not Net Kâr", () => {
    assert.equal(CASH_RESULT_LABEL, "Operasyonel Nakit Sonucu");
    assert.match(CASH_RESULT_TOOLTIP, /nakit girişleri/);
    assert.equal(ACCRUAL_PROFIT_LABEL, "Tahakkuk Kârı");

    const summary = buildCanonicalFinancialSummary(
      [
        {
          id: "1",
          date: new Date("2026-07-05T12:00:00+03:00"),
          createdAt: new Date("2026-07-05T12:00:00+03:00"),
          title: "Satış Tahsilatı - SAT-1",
          amount: 1000,
          type: "INCOME",
          note: null,
        },
      ],
      [
        {
          amount: 200,
          date: new Date("2026-07-06T12:00:00+03:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
      ],
      new Date("2026-06-30T21:00:00.000Z"),
      new Date("2026-07-31T21:00:00.000Z"),
      { toMode: "exclusive", accrualSalesTotal: 900 }
    );

    assert.equal(summary.profit.label, CASH_RESULT_LABEL);
    assert.equal(summary.profit.operational, 800);
    assert.equal(summary.profit.accrual, 700);
    assert.equal(
      summary.profit.operational,
      summary.revenue.total - summary.expenses.cashTotal
    );
  });
});

describe("chart buckets equal KPI totals", () => {
  it("daily sales chart sum equals month KPI for Istanbul period", () => {
    const period = resolveMonthFinancialPeriod({
      referenceDate: new Date("2026-07-15T12:00:00+03:00"),
    });
    const sales = [
      {
        total: 100,
        createdAt: zonedWallTimeToUtc({
          year: 2026,
          month: 7,
          day: 1,
          hour: 0,
          minute: 0,
        }),
      },
      {
        total: 250,
        createdAt: zonedWallTimeToUtc({
          year: 2026,
          month: 7,
          day: 31,
          hour: 23,
          minute: 59,
          second: 59,
        }),
      },
      {
        // August 1 Istanbul — excluded
        total: 999,
        createdAt: period.toExclusive,
      },
    ];

    const chart = buildDailySalesChart(
      sales,
      period.from,
      period.toExclusive
    );
    const chartSum = chart.reduce((sum, point) => sum + point.amount, 0);
    assert.equal(chartSum, 350);
  });

  it("monthly cash-flow bucket sum equals period KPI", () => {
    const from = startOfZonedMonth(new Date("2026-07-15T12:00:00+03:00"));
    const toExclusive = startOfNextZonedMonth(from);
    const txs = [
      {
        id: "1",
        date: zonedWallTimeToUtc({ year: 2026, month: 7, day: 10, hour: 12 }),
        createdAt: zonedWallTimeToUtc({ year: 2026, month: 7, day: 10, hour: 12 }),
        title: "Manuel gelir",
        amount: 500,
        type: "INCOME",
        note: null,
      },
      {
        id: "2",
        date: zonedWallTimeToUtc({ year: 2026, month: 7, day: 12, hour: 12 }),
        createdAt: zonedWallTimeToUtc({ year: 2026, month: 7, day: 12, hour: 12 }),
        title: "Kasa gideri",
        amount: 100,
        type: "EXPENSE",
        note: null,
      },
      {
        id: "xfer",
        date: zonedWallTimeToUtc({ year: 2026, month: 7, day: 13, hour: 12 }),
        createdAt: zonedWallTimeToUtc({ year: 2026, month: 7, day: 13, hour: 12 }),
        title: "Transfer Çıkışı - Banka",
        amount: 50,
        type: "TRANSFER",
        note: null,
      },
    ];
    const expenses = [
      {
        amount: 80,
        date: zonedWallTimeToUtc({ year: 2026, month: 7, day: 15, hour: 10 }),
        paymentStatus: "PAID",
        status: "APPROVED",
      },
    ];

    const summary = buildCanonicalFinancialSummary(
      txs,
      expenses,
      from,
      toExclusive,
      { toMode: "exclusive" }
    );
    const buckets = buildMonthlyCashFlowData(txs, expenses, from, toExclusive, 6, {
      toMode: "exclusive",
    });
    const bucketIncome = buckets.reduce((s, b) => s + b.income, 0);
    const bucketExpense = buckets.reduce((s, b) => s + b.expense, 0);
    const bucketNet = buckets.reduce((s, b) => s + b.net, 0);

    assert.equal(bucketIncome, summary.revenue.total);
    assert.equal(bucketExpense, summary.expenses.cashTotal);
    assert.equal(bucketNet, summary.profit.operational);
  });
});

describe("UI label remnants", () => {
  it("dashboard/report source files do not use bare Net Kâr for cash result", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const web = process.cwd();
    const files = [
      "lib/dashboard-page-data.ts",
      "lib/reports-page-utils.ts",
      "components/dashboard/dashboard-income-chart.tsx",
      "lib/finance/financial-summary-service.ts",
    ];
    for (const relative of files) {
      const src = readFileSync(join(web, relative), "utf8");
      assert.ok(
        !src.includes('profitLabel: "Net Kâr"'),
        relative
      );
      assert.ok(
        !src.includes('title: "Net Kâr"'),
        relative
      );
      assert.ok(
        src.includes("Operasyonel Nakit Sonucu") ||
          src.includes("CASH_RESULT_LABEL"),
        relative
      );
    }
  });
});
