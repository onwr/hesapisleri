import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sumPosPaymentAmounts,
  validatePosCheckoutPayments,
} from "./pos-checkout-utils";

describe("pos checkout payments", () => {
  it("requires payments for paid checkout", () => {
    assert.equal(
      validatePosCheckoutPayments({
        payments: [],
        paymentStatus: "PAID",
        total: 1750,
      }),
      "Tahsilat için en az bir ödeme satırı ve hesap seçimi gerekir."
    );
  });

  it("blocks payment total mismatch", () => {
    assert.match(
      validatePosCheckoutPayments({
        payments: [
          { paymentMethod: "CASH", amount: 500, accountId: "cash-1" },
          { paymentMethod: "CARD", amount: 1000, accountId: "bank-1" },
        ],
        paymentStatus: "PAID",
        total: 1750,
      }) ?? "",
      /eşit olmalıdır/
    );
  });

  it("accepts split payments that match sale total", () => {
    assert.equal(
      validatePosCheckoutPayments({
        payments: [
          { paymentMethod: "CASH", amount: 500, accountId: "cash-1" },
          { paymentMethod: "CARD", amount: 1000, accountId: "bank-1" },
          { paymentMethod: "BANK_TRANSFER", amount: 250, accountId: "bank-2" },
        ],
        paymentStatus: "PAID",
        total: 1750,
      }),
      null
    );
  });

  it("sums payment lines with rounding", () => {
    assert.equal(
      sumPosPaymentAmounts([
        { amount: 500 },
        { amount: 1000.15 },
        { amount: 249.85 },
      ]),
      1750
    );
  });
});
