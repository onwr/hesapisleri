import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachRunningBalances,
  buildAccountTransactionsCsv,
  computeAccountMetrics,
  extractTransactionReference,
  getTransactionDirection,
  getTransactionSignedAmount,
  inferTransactionSource,
  roundCashMoney,
  validateTransferAccounts,
} from "./cash-bank-account-utils";

describe("cash bank account utils", () => {
  it("INCOME giriş yönü verir", () => {
    assert.equal(
      getTransactionDirection({ type: "INCOME", title: "Manuel gelir" }),
      "in"
    );
  });

  it("EXPENSE çıkış yönü verir", () => {
    assert.equal(
      getTransactionDirection({ type: "EXPENSE", title: "Manuel gider" }),
      "out"
    );
  });

  it("TRANSFER çıkış başlığından çıkış yönü çıkarır", () => {
    assert.equal(
      getTransactionDirection({
        type: "TRANSFER",
        title: "Transfer Çıkışı - Banka",
      }),
      "out"
    );
    assert.equal(
      getTransactionDirection({
        type: "TRANSFER",
        title: "Transfer Girişi - Kasa",
      }),
      "in"
    );
  });

  it("signed amount giriş ve çıkışta doğru işaretlenir", () => {
    assert.equal(
      getTransactionSignedAmount({
        type: "INCOME",
        title: "Gelir",
        amount: 100,
      }),
      100
    );
    assert.equal(
      getTransactionSignedAmount({
        type: "EXPENSE",
        title: "Gider",
        amount: 50,
      }),
      -50
    );
  });

  it("satış tahsilatını kaynak olarak tanır", () => {
    const source = inferTransactionSource({
      type: "INCOME",
      title: "Satış Tahsilatı - SAT-001",
      note: null,
    });

    assert.equal(source.key, "collection");
    assert.equal(source.label, "Tahsilat");
  });

  it("satış iptalini kaynak olarak tanır", () => {
    const source = inferTransactionSource({
      type: "EXPENSE",
      title: "Satış İptali - SAT-002",
      note: null,
    });

    assert.equal(source.key, "cancel");
    assert.equal(source.label, "İptal");
  });

  it("referans numarasını başlıktan çıkarır", () => {
    assert.equal(
      extractTransactionReference("Satış Tahsilatı - SAT-001"),
      "SAT-001"
    );
  });

  it("running balance mevcut bakiyeyle uyumlu hesaplanır", () => {
    const now = new Date("2026-06-01T10:00:00");
    const transactions = [
      {
        id: "t1",
        date: new Date("2026-06-01T09:00:00"),
        createdAt: new Date("2026-06-01T09:00:00"),
        title: "Açılış",
        amount: 100,
        type: "INCOME",
      },
      {
        id: "t2",
        date: new Date("2026-06-02T09:00:00"),
        createdAt: new Date("2026-06-02T09:00:00"),
        title: "Gider",
        amount: 30,
        type: "EXPENSE",
      },
    ];

    const withBalances = attachRunningBalances(transactions, 70);
    const t1 = withBalances.find((item) => item.id === "t1");
    const t2 = withBalances.find((item) => item.id === "t2");

    assert.equal(t1?.balanceAfter, 100);
    assert.equal(t2?.balanceAfter, 70);
  });

  it("metrikleri toplam ve aylık giriş/çıkış için hesaplar", () => {
    const now = new Date("2026-06-15T12:00:00");
    const metrics = computeAccountMetrics(
      [
        {
          id: "1",
          date: new Date("2026-06-10T10:00:00"),
          createdAt: new Date("2026-06-10T10:00:00"),
          title: "Gelir",
          amount: 200,
          type: "INCOME",
        },
        {
          id: "2",
          date: new Date("2026-06-12T10:00:00"),
          createdAt: new Date("2026-06-12T10:00:00"),
          title: "Gider",
          amount: 50,
          type: "EXPENSE",
        },
        {
          id: "3",
          date: new Date("2026-05-01T10:00:00"),
          createdAt: new Date("2026-05-01T10:00:00"),
          title: "Eski gelir",
          amount: 100,
          type: "INCOME",
        },
      ],
      250,
      now
    );

    assert.equal(metrics.currentBalance, 250);
    assert.equal(metrics.totalIn, 300);
    assert.equal(metrics.totalOut, 50);
    assert.equal(metrics.monthIn, 200);
    assert.equal(metrics.monthOut, 50);
  });

  it("transfer validasyonu aynı hesabı reddeder", () => {
    assert.equal(
      validateTransferAccounts("acc-1", "acc-1", 100),
      "Kaynak ve hedef hesap aynı olamaz."
    );
  });

  it("transfer validasyonu geçersiz tutarı reddeder", () => {
    assert.equal(
      validateTransferAccounts("acc-1", "acc-2", 0),
      "Transfer tutarı 0'dan büyük olmalıdır."
    );
  });

  it("manuel gelir bakiyeyi artırır", () => {
    const current = 100;
    const amount = 25;
    const next = roundCashMoney(current + amount);
    assert.equal(next, 125);
  });

  it("manuel gider bakiyeyi azaltır", () => {
    const current = 100;
    const amount = 40;
    const next = roundCashMoney(current - amount);
    assert.equal(next, 60);
  });

  it("transferde kaynak azalır hedef artar", () => {
    const from = 500;
    const to = 200;
    const amount = 150;
    const fromNext = roundCashMoney(from - amount);
    const toNext = roundCashMoney(to + amount);
    assert.equal(fromNext, 350);
    assert.equal(toNext, 350);
  });

  it("CSV export beklenen kolonları içerir", () => {
    const csv = buildAccountTransactionsCsv([
      {
        id: "1",
        date: new Date("2026-06-01T10:00:00"),
        createdAt: new Date("2026-06-01T10:00:00"),
        title: "Test",
        note: "Not",
        amount: 100,
        type: "INCOME",
        balanceAfter: 100,
      },
    ]);

    assert.match(csv, /^Tarih,Başlık,Not,Tutar,Tip,Bakiye/);
    assert.match(csv, /Test/);
    assert.match(csv, /100\.00/);
  });
});
