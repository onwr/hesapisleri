import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExpenseTransactionTitle,
  calculateExpenseBalanceChange,
  isActiveExpenseRecord,
  isPaidExpense,
  mergeExpenseCategories,
  normalizeExpenseCategory,
} from "./expense-utils";
import {
  combineFinanceBreakdown,
  sumPaidExpenseCashOut,
  sumRecordedUnpaidExpenses,
} from "./finance-aggregation-utils";

describe("expense utils", () => {
  it("PAID gider için hesap bakiyesi düşüş yönü hesaplar", () => {
    assert.equal(calculateExpenseBalanceChange("PAID", 100, "charge"), -100);
    assert.equal(calculateExpenseBalanceChange("PAID", 100, "refund"), 100);
  });

  it("UNPAID gider bakiyeyi etkilemez", () => {
    assert.equal(calculateExpenseBalanceChange("UNPAID", 100, "charge"), 0);
  });

  it("gider başlığı transaction formatına çevrilir", () => {
    assert.equal(buildExpenseTransactionTitle("Kira"), "Gider - Kira");
  });

  it("kategori listesi birleştirilir", () => {
    const categories = mergeExpenseCategories(["Ofis"], ["Kira", "Ofis"]);
    assert.ok(categories.includes("Kira"));
    assert.ok(categories.includes("Ofis"));
  });

  it("boş kategori Diğer olur", () => {
    assert.equal(normalizeExpenseCategory(""), "Diğer");
  });

  it("CANCELLED gider aktif sayılmaz", () => {
    assert.equal(isActiveExpenseRecord({ status: "CANCELLED" }), false);
    assert.equal(isActiveExpenseRecord({ status: "APPROVED" }), true);
  });

  it("PAID gider ödeme durumu doğru algılanır", () => {
    assert.equal(isPaidExpense({ paymentStatus: "PAID" }), true);
    assert.equal(isPaidExpense({ paymentStatus: "UNPAID" }), false);
  });
});

describe("expense finance aggregation", () => {
  const from = new Date("2026-06-01T00:00:00");
  const to = new Date("2026-06-30T23:59:59");

  it("PAID gider nakit çıkışına dahil edilir", () => {
    const paid = sumPaidExpenseCashOut(
      [
        {
          amount: 150,
          date: new Date("2026-06-10T10:00:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(paid, 150);
  });

  it("UNPAID gider kayıtlı gider olarak kalır, nakit çıkışına girmez", () => {
    const unpaid = sumRecordedUnpaidExpenses(
      [
        {
          amount: 80,
          date: new Date("2026-06-10T10:00:00"),
          paymentStatus: "UNPAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    const breakdown = combineFinanceBreakdown(
      [
        {
          id: "tx-1",
          date: new Date("2026-06-10T10:00:00"),
          createdAt: new Date("2026-06-10T10:00:00"),
          title: "Gider - Kira",
          note: null,
          amount: 80,
          type: "EXPENSE",
          expenseId: "exp-1",
        },
      ],
      [
        {
          amount: 80,
          date: new Date("2026-06-10T10:00:00"),
          paymentStatus: "UNPAID",
          status: "APPROVED",
        },
        {
          amount: 150,
          date: new Date("2026-06-12T10:00:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(unpaid, 80);
    assert.equal(breakdown.paidExpenseTotal, 150);
    assert.equal(breakdown.totalExpense, 150);
    assert.equal(breakdown.recordedExpenseTotal, 80);
  });

  it("CANCELLED gider rapora dahil edilmez", () => {
    const breakdown = combineFinanceBreakdown(
      [],
      [
        {
          amount: 200,
          date: new Date("2026-06-10T10:00:00"),
          paymentStatus: "PAID",
          status: "CANCELLED",
        },
      ],
      from,
      to
    );

    assert.equal(breakdown.paidExpenseTotal, 0);
    assert.equal(breakdown.totalAccruedExpense, 0);
  });
});
