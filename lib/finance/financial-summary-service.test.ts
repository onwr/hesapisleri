import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalFinancialSummary } from "./financial-summary-service";
import { resolveMonthFinancialPeriod } from "./financial-period";

describe("buildCanonicalFinancialSummary", () => {
  const from = new Date("2026-07-01T00:00:00");
  const to = new Date("2026-07-31T23:59:59.999");

  it("operational profit equals revenue - cash expense (mirrors excluded from expense)", () => {
    const summary = buildCanonicalFinancialSummary(
      [
        {
          id: "in-1",
          date: new Date("2026-07-05T12:00:00"),
          createdAt: new Date("2026-07-05T12:00:00"),
          title: "Satış Tahsilatı - SAT-001",
          amount: 1000,
          type: "INCOME",
          note: null,
        },
        {
          id: "in-2",
          date: new Date("2026-07-06T12:00:00"),
          createdAt: new Date("2026-07-06T12:00:00"),
          title: "Manuel gelir",
          amount: 200,
          type: "INCOME",
          note: null,
        },
        {
          id: "out-manual",
          date: new Date("2026-07-07T12:00:00"),
          createdAt: new Date("2026-07-07T12:00:00"),
          title: "Kasa gideri",
          amount: 150,
          type: "EXPENSE",
          note: null,
        },
        {
          id: "mirror",
          date: new Date("2026-07-08T12:00:00"),
          createdAt: new Date("2026-07-08T12:00:00"),
          title: "Satış İptali - SAT-002",
          amount: 334,
          type: "EXPENSE",
          note: "[REVERSAL] SAT-002 numaralı satış iptal edildi.",
        },
        {
          id: "xfer-out",
          date: new Date("2026-07-09T12:00:00"),
          createdAt: new Date("2026-07-09T12:00:00"),
          title: "Transfer Çıkışı - Banka",
          amount: 500,
          type: "TRANSFER",
          note: null,
        },
        {
          id: "xfer-in",
          date: new Date("2026-07-09T12:00:00"),
          createdAt: new Date("2026-07-09T12:00:00"),
          title: "Transfer Girişi - Kasa",
          amount: 500,
          type: "TRANSFER",
          note: null,
        },
      ],
      [
        {
          amount: 300,
          date: new Date("2026-07-10T12:00:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
        {
          amount: 90,
          date: new Date("2026-07-11T12:00:00"),
          paymentStatus: "UNPAID",
          status: "APPROVED",
        },
        {
          amount: 50,
          date: new Date("2026-07-12T12:00:00"),
          paymentStatus: "PAID",
          status: "CANCELLED",
        },
      ],
      from,
      to
    );

    assert.equal(summary.revenue.total, 1200);
    assert.equal(summary.expenses.cashTotal, 450);
    assert.equal(summary.adjustments.financeMirrorOutTotal, 334);
    assert.equal(summary.adjustments.transferInTotal, 500);
    assert.equal(summary.adjustments.transferOutTotal, 500);
    assert.equal(summary.profit.operational, 750);
    assert.equal(
      summary.profit.operational,
      summary.revenue.total - summary.expenses.cashTotal
    );
    assert.equal(summary.profit.cashNet, 416);
    assert.equal(
      summary.profit.cashNet,
      summary.revenue.total -
        summary.expenses.cashTotal -
        summary.adjustments.financeMirrorOutTotal
    );
    assert.equal(summary.expenses.accruedTotal, 390);
    assert.equal(summary.profit.label, "Operasyonel Nakit Sonucu");
  });

  it("cancelled and unpaid expenses do not inflate cash expense incorrectly", () => {
    const summary = buildCanonicalFinancialSummary(
      [],
      [
        {
          amount: 100,
          date: new Date("2026-07-03T10:00:00"),
          paymentStatus: "PAID",
          status: "CANCELLED",
        },
        {
          amount: 200,
          date: new Date("2026-07-04T10:00:00"),
          paymentStatus: "UNPAID",
          status: "APPROVED",
        },
        {
          amount: 75,
          date: new Date("2026-07-05T10:00:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(summary.expenses.cashTotal, 75);
    assert.equal(summary.expenses.unpaidAccrued, 200);
    assert.equal(summary.profit.operational, -75);
  });
});

describe("resolveMonthFinancialPeriod", () => {
  it("uses Istanbul month bounds as half-open range", () => {
    const period = resolveMonthFinancialPeriod(
      new Date("2026-07-15T12:00:00+03:00")
    );
    assert.equal(period.from.toISOString().startsWith("2026-06-30") || period.from.getDate() === 1, true);
    assert.ok(period.toExclusive.getTime() > period.from.getTime());
    assert.equal(period.toInclusive.getTime(), period.toExclusive.getTime() - 1);
  });
});
