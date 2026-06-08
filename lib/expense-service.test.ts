import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildExpensePaymentTransactionTitle,
  calculateExpenseBalanceChange,
  getExpenseDisplayPaymentBadge,
  validateExpenseAmountUpdate,
  validateExpensePayEligibility,
} from "./expense-utils";
import { combineFinanceBreakdown } from "./finance-aggregation-utils";

describe("expense service rules", () => {
  it("PAID gider oluşturulunca hesap bakiyesi düşer", () => {
    assert.equal(calculateExpenseBalanceChange("PAID", 250, "charge"), -250);
  });

  it("UNPAID gider oluşturulunca hesap bakiyesi değişmez", () => {
    assert.equal(calculateExpenseBalanceChange("UNPAID", 250, "charge"), 0);
  });

  it("PAID gider iptal edilince hesap bakiyesi geri artar", () => {
    assert.equal(calculateExpenseBalanceChange("PAID", 250, "refund"), 250);
  });

  it("UNPAID gider iptal edilince hesap bakiyesi değişmez", () => {
    assert.equal(calculateExpenseBalanceChange("UNPAID", 250, "refund"), 0);
  });

  it("PAID giderde tutar güncellenemez", () => {
    const result = validateExpenseAmountUpdate(
      { paymentStatus: "PAID", status: "APPROVED" },
      500
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /tutar/i);
    }
  });

  it("UNPAID giderde tutar güncellenebilir", () => {
    const result = validateExpenseAmountUpdate(
      { paymentStatus: "UNPAID", status: "APPROVED" },
      500
    );

    assert.equal(result.ok, true);
  });

  it("CANCELLED gider düzenlenemez", () => {
    const result = validateExpenseAmountUpdate(
      { paymentStatus: "UNPAID", status: "CANCELLED" },
      100
    );

    assert.equal(result.ok, false);
  });

  it("iptal edilmiş giderde ödeme rozeti İptal gösterir", () => {
    const badge = getExpenseDisplayPaymentBadge({
      paymentStatus: "PAID",
      status: "CANCELLED",
    });

    assert.equal(badge.label, "İptal");
  });

  it("UNPAID gider ödenebilir", () => {
    const result = validateExpensePayEligibility({
      paymentStatus: "UNPAID",
      status: "APPROVED",
      accountTransaction: null,
    });

    assert.equal(result.ok, true);
  });

  it("PAID gider tekrar ödenemez", () => {
    const result = validateExpensePayEligibility({
      paymentStatus: "PAID",
      status: "APPROVED",
      accountTransaction: { id: "tx-1" },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /ödenmiş/i);
    }
  });

  it("CANCELLED gider ödenemez", () => {
    const result = validateExpensePayEligibility({
      paymentStatus: "UNPAID",
      status: "CANCELLED",
      accountTransaction: null,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message.toLocaleLowerCase("tr-TR"), /iptal/);
    }
  });

  it("ödeme transaction başlığı doğru formatlanır", () => {
    assert.equal(
      buildExpensePaymentTransactionTitle("Kira"),
      "Gider Ödemesi - Kira"
    );
  });

  it("UNPAID gider ödendikten sonra finans agregasyonunda çift sayım olmaz", () => {
    const from = new Date("2026-06-01T00:00:00");
    const to = new Date("2026-06-30T23:59:59");

    const breakdown = combineFinanceBreakdown(
      [
        {
          id: "tx-1",
          date: new Date("2026-06-15T10:00:00"),
          createdAt: new Date("2026-06-15T10:00:00"),
          title: "Gider Ödemesi - Kira",
          note: null,
          amount: 120,
          type: "EXPENSE",
          expenseId: "exp-1",
        },
      ],
      [
        {
          amount: 120,
          date: new Date("2026-06-01T10:00:00"),
          paymentStatus: "PAID",
          status: "APPROVED",
        },
      ],
      from,
      to
    );

    assert.equal(breakdown.paidExpenseTotal, 120);
    assert.equal(breakdown.recordedExpenseTotal, 0);
    assert.equal(breakdown.totalExpense, 120);
  });
});
