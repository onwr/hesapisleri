import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterBulkExpenses,
  matchesBulkExpenseSearch,
  parseBulkExpenseFilters,
  summarizeBulkExpenseList,
  summarizeBulkSelection,
  toBulkExpenseRow,
} from "./expense-bulk-actions-service";

describe("expense bulk actions service", () => {
  const sourceRows = [
    {
      id: "e1",
      title: "Ofis kirası",
      category: "Kira",
      amount: 1000,
      paymentStatus: "PAID",
      status: "APPROVED",
      date: new Date("2026-06-01"),
      note: "Haziran",
      account: { name: "Kasa" },
    },
    {
      id: "e2",
      title: "Elektrik faturası",
      category: "Elektrik",
      amount: 250,
      paymentStatus: "UNPAID",
      status: "APPROVED",
      date: new Date("2026-06-05"),
      note: null,
      account: null,
    },
    {
      id: "e3",
      title: "İptal edilen",
      category: "Kira",
      amount: 100,
      paymentStatus: "PAID",
      status: "CANCELLED",
      date: new Date("2026-06-02"),
      note: null,
      account: null,
    },
  ];

  it("bulk filtreleri parse eder", () => {
    const filters = parseBulkExpenseFilters({
      q: "elektrik",
      category: "Elektrik",
      paymentStatus: "UNPAID",
      status: "ACTIVE",
      from: "2026-06-01",
      to: "2026-06-30",
    });

    assert.equal(filters.q, "elektrik");
    assert.equal(filters.category, "Elektrik");
    assert.equal(filters.paymentStatus, "UNPAID");
    assert.equal(filters.status, "ACTIVE");
    assert.ok(filters.from);
    assert.ok(filters.to);
  });

  it("arama filtresi çalışır", () => {
    assert.equal(matchesBulkExpenseSearch(sourceRows[1], "elektrik"), true);
    assert.equal(matchesBulkExpenseSearch(sourceRows[0], "elektrik"), false);
  });

  it("kategori ve ödeme filtreleri çalışır", () => {
    const filtered = filterBulkExpenses(sourceRows, {
      q: null,
      category: "Kira",
      paymentStatus: "PAID",
      status: "ACTIVE",
      from: null,
      to: null,
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "e1");
  });

  it("liste özetini hesaplar", () => {
    const rows = sourceRows.map(toBulkExpenseRow);
    const summary = summarizeBulkExpenseList(rows);

    assert.equal(summary.totalCount, 3);
    assert.equal(summary.paidCount, 1);
    assert.equal(summary.unpaidCount, 1);
    assert.equal(summary.totalAmount, 1250);
  });

  it("seçim özetini hesaplar", () => {
    const rows = sourceRows.map(toBulkExpenseRow);
    const selection = summarizeBulkSelection(rows, new Set(["e1", "e2"]));

    assert.equal(selection.selectedCount, 2);
    assert.equal(selection.selectedAmount, 1250);
    assert.equal(selection.unpaidSelectedAmount, 250);
    assert.equal(selection.topCategory, "Kira");
  });
});
