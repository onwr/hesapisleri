import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateAccountTransactions,
  combineFinanceBreakdown,
  shouldExcludeFromIncomeExpenseTotals,
  sumActiveAccountBalances,
} from "./finance-aggregation-utils";

const baseDate = new Date("2026-06-10T10:00:00");

function tx(
  overrides: Partial<{
    id: string;
    type: string;
    title: string;
    amount: number;
    note: string | null;
  }>
) {
  return {
    id: overrides.id ?? "tx-1",
    date: baseDate,
    createdAt: baseDate,
    title: overrides.title ?? "Test",
    note: overrides.note ?? null,
    amount: overrides.amount ?? 100,
    type: overrides.type ?? "INCOME",
  };
}

describe("finance aggregation", () => {
  it("manuel gelir toplam gelire dahil edilir", () => {
    const result = aggregateAccountTransactions([
      tx({ id: "1", type: "INCOME", title: "Ofis geliri", amount: 200 }),
    ]);

    assert.equal(result.manualIncome, 200);
    assert.equal(result.totalIncome, 200);
  });

  it("satış tahsilatı ayrı gelir kalemi olarak sayılır", () => {
    const result = aggregateAccountTransactions([
      tx({
        id: "1",
        type: "INCOME",
        title: "Satış Tahsilatı - SAT-001",
        amount: 500,
      }),
    ]);

    assert.equal(result.saleCollectionIncome, 500);
    assert.equal(result.manualIncome, 0);
    assert.equal(result.totalIncome, 500);
  });

  it("transfer gelir/gider toplamına dahil edilmez", () => {
    const result = aggregateAccountTransactions([
      tx({
        id: "1",
        type: "TRANSFER",
        title: "Transfer Çıkışı - Banka",
        amount: 300,
      }),
      tx({
        id: "2",
        type: "TRANSFER",
        title: "Transfer Girişi - Kasa",
        amount: 300,
      }),
      tx({ id: "3", type: "INCOME", title: "Manuel gelir", amount: 100 }),
    ]);

    assert.equal(result.totalIncome, 100);
    assert.equal(result.totalExpense, 0);
    assert.equal(result.transferOutTotal, 300);
    assert.equal(result.transferInTotal, 300);
  });

  it("satış iptali ters kayıt olarak ayrılır, operasyonel gidere dahil edilmez", () => {
    const result = aggregateAccountTransactions([
      tx({
        id: "1",
        type: "EXPENSE",
        title: "Satış İptali - SAT-002",
        note: "[REVERSAL] SAT-002 numaralı satış iptal edildi.",
        amount: 250,
      }),
    ]);

    assert.equal(result.reversalOutTotal, 250);
    assert.equal(result.financeMirrorOutTotal, 250);
    assert.equal(result.saleCancelExpense, 250);
    assert.equal(result.totalExpense, 0);
    assert.equal(result.netCashFlow, -250);
  });

  it("satış düzeltme geri alımı correction olarak ayrılır", () => {
    const result = aggregateAccountTransactions([
      tx({
        id: "1",
        type: "EXPENSE",
        title: "Satış Düzeltme Geri Alım - SAT-003",
        note: "[CORRECTION] önceki tahsilat geri alındı.",
        amount: 120,
      }),
    ]);

    assert.equal(result.correctionOutTotal, 120);
    assert.equal(result.totalExpense, 0);
    assert.equal(result.netCashFlow, -120);
  });

  it("manuel gider ve kayıtlı gider birleştirilir", () => {
    const from = new Date("2026-06-01T00:00:00");
    const to = new Date("2026-06-30T23:59:59");

    const result = combineFinanceBreakdown(
      [
        {
          id: "1",
          date: new Date("2026-06-05T12:00:00"),
          createdAt: new Date("2026-06-05T12:00:00"),
          title: "Kasa gideri",
          amount: 80,
          type: "EXPENSE",
        },
      ],
      [
        {
          amount: 120,
          date: new Date("2026-06-05T12:00:00"),
          paymentStatus: "UNPAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(result.recordedExpenseTotal, 120);
    assert.equal(result.manualCashExpense, 80);
    assert.equal(result.totalExpense, 80);
    assert.equal(result.totalAccruedExpense, 120);
  });

  it("transfer toplam gelir/gider hesabına karışmaz", () => {
    assert.equal(
      shouldExcludeFromIncomeExpenseTotals({
        type: "TRANSFER",
        title: "Transfer Girişi - Kasa",
      }),
      true
    );
  });

  it("aktif hesap bakiyeleri toplanır", () => {
    const total = sumActiveAccountBalances([
      { balance: 100, status: "ACTIVE" },
      { balance: 50, status: "INACTIVE" },
      { balance: 25, status: "ACTIVE" },
    ]);

    assert.equal(total, 125);
  });
});
