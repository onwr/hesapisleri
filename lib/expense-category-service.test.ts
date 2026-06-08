import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExpenseCategoryStats,
  summarizeExpenseCategoriesPage,
} from "./expense-category-service";
import {
  isDefaultExpenseCategoryName,
  normalizeExpenseCategoryName,
} from "./expense-category-utils";

describe("expense category service utils", () => {
  const expenses = [
    {
      category: "Kira",
      amount: 1000,
      paymentStatus: "PAID",
      status: "APPROVED",
      date: new Date("2026-06-01"),
    },
    {
      category: "Kira",
      amount: 500,
      paymentStatus: "UNPAID",
      status: "APPROVED",
      date: new Date("2026-06-10"),
    },
    {
      category: "Elektrik",
      amount: 200,
      paymentStatus: "UNPAID",
      status: "APPROVED",
      date: new Date("2026-05-01"),
    },
    {
      category: "Kira",
      amount: 300,
      paymentStatus: "PAID",
      status: "CANCELLED",
      date: new Date("2026-06-02"),
    },
  ];

  it("kategori istatistiklerini hesaplar", () => {
    const stats = computeExpenseCategoryStats(expenses, "Kira");

    assert.equal(stats.expenseCount, 2);
    assert.equal(stats.paidExpenseCount, 1);
    assert.equal(stats.unpaidExpenseCount, 1);
    assert.equal(stats.totalAmount, 1500);
    assert.equal(stats.paidAmount, 1000);
    assert.equal(stats.unpaidAmount, 500);
  });

  it("sayfa özetini hesaplar", () => {
    const summary = summarizeExpenseCategoriesPage(
      [
        {
          id: "1",
          name: "Kira",
          color: "violet",
          note: null,
          sortOrder: 0,
          status: "ACTIVE",
        },
        {
          id: "2",
          name: "Elektrik",
          color: "orange",
          note: null,
          sortOrder: 1,
          status: "PASSIVE",
        },
      ],
      expenses
    );

    assert.equal(summary.totalCategories, 2);
    assert.equal(summary.activeCategories, 1);
    assert.equal(summary.totalExpenseAmount, 1700);
    assert.equal(summary.unpaidAmount, 700);
  });

  it("Diğer varsayılan kategori adını tanır", () => {
    assert.equal(isDefaultExpenseCategoryName("Diğer"), true);
    assert.equal(normalizeExpenseCategoryName(""), "Diğer");
  });
});
