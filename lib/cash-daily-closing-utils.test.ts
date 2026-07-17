import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateClosingDifference,
  getClosingDifferenceKind,
  getClosingDifferenceLabel,
  computeExpectedCashAtPeriodEnd,
  resolveClosingPeriod,
  summarizeAccountTransactionsForPeriod,
  validateCountedCashAmount,
} from "./cash-daily-closing-utils";
import { startOfZonedDay } from "./finance/financial-period";

describe("cash daily closing utils", () => {
  it("fark hesapları dengede/fazla/açık etiketleri üretir", () => {
    assert.equal(calculateClosingDifference(1000, 1000), 0);
    assert.equal(getClosingDifferenceKind(0), "balanced");
    assert.equal(getClosingDifferenceLabel(0), "Kasa dengede");

    assert.equal(calculateClosingDifference(1000, 1050), 50);
    assert.equal(getClosingDifferenceKind(50), "surplus");
    assert.equal(getClosingDifferenceLabel(50), "Kasa fazlası");

    assert.equal(calculateClosingDifference(1000, 950), -50);
    assert.equal(getClosingDifferenceKind(-50), "shortage");
    assert.equal(getClosingDifferenceLabel(-50), "Kasa açığı");
  });

  it("sayılan kasa tutarını doğrular", () => {
    assert.equal(validateCountedCashAmount(-1).ok, false);
    assert.equal(validateCountedCashAmount("abc").ok, false);
    const ok = validateCountedCashAmount("1000,50");
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.amount, 1000.5);
  });

  it("Istanbul gün sınırı half-open period üretir", () => {
    const period = resolveClosingPeriod("2026-07-14");
    assert.equal(period.periodStart.getTime(), startOfZonedDay(period.periodStart).getTime());
    assert.ok(period.periodEnd.getTime() > period.periodStart.getTime());
    assert.equal(period.closingDate.getTime(), period.periodStart.getTime());
  });

  it("periodEnd sonrası hareketleri teorik bakiyeden düşer", () => {
    const periodEnd = new Date("2026-07-15T00:00:00.000Z");
    const expected = computeExpectedCashAtPeriodEnd({
      currentBalance: 1500,
      periodEnd,
      transactions: [
        {
          type: "INCOME",
          title: "Satış",
          amount: 200,
          date: new Date("2026-07-15T10:00:00.000Z"),
        },
      ],
    });
    assert.equal(expected, 1300);
  });

  it("transferleri tahsilat/gider gibi saymaz, ayrı toplar", () => {
    const periodStart = new Date("2026-07-14T00:00:00.000Z");
    const periodEnd = new Date("2026-07-15T00:00:00.000Z");
    const summary = summarizeAccountTransactionsForPeriod({
      periodStart,
      periodEnd,
      transactions: [
        {
          type: "INCOME",
          title: "Satış Tahsilatı",
          amount: 1000,
          date: new Date("2026-07-14T10:00:00.000Z"),
        },
        {
          type: "COLLECTION",
          title: "Cari tahsilat — Ali",
          amount: 500,
          date: new Date("2026-07-14T11:00:00.000Z"),
        },
        {
          type: "EXPENSE",
          title: "Gider",
          amount: 200,
          date: new Date("2026-07-14T12:00:00.000Z"),
        },
        {
          type: "TRANSFER",
          title: "Transfer çıkış",
          amount: 100,
          date: new Date("2026-07-14T13:00:00.000Z"),
        },
        {
          type: "TRANSFER",
          title: "Transfer giriş",
          amount: 50,
          date: new Date("2026-07-14T14:00:00.000Z"),
        },
      ],
    });

    assert.equal(summary.totalCollections, 500);
    assert.equal(summary.totalExpenses, 200);
    assert.equal(summary.totalTransfersOut, 100);
    assert.equal(summary.totalTransfersIn, 50);
    assert.equal(summary.periodNet, 1250);
  });
});
