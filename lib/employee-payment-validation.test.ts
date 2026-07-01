import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_PAYMENT_VALIDATION_MESSAGES,
  parseEmployeePaymentAmount,
  validateEmployeePaymentAccount,
  validateEmployeePaymentCreateInput,
} from "./employee-payment-validation";

describe("employee payment validation", () => {
  it("NaN tutar reddi", () => {
    const result = parseEmployeePaymentAmount(Number.NaN);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.invalidAmountNumeric);
    }
  });

  it("sıfır ve negatif tutar reddi", () => {
    assert.equal(parseEmployeePaymentAmount(0).ok, false);
    assert.equal(parseEmployeePaymentAmount(-10).ok, false);
  });

  it("pasif hesap reddi", () => {
    const result = validateEmployeePaymentAccount(
      {
        id: "a1",
        companyId: "c1",
        type: "CASH",
        status: "PASSIVE",
        currency: "TRY",
        name: "Kasa",
        balance: 1000,
      },
      "c1"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.passiveAccount);
    }
  });

  it("foreign account reddi", () => {
    const result = validateEmployeePaymentAccount(
      {
        id: "a1",
        companyId: "c2",
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        name: "Kasa",
        balance: 1000,
      },
      "c1"
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.foreignAccount);
    }
  });

  it("yetersiz bakiye reddi", () => {
    const result = validateEmployeePaymentAccount(
      {
        id: "a1",
        companyId: "c1",
        type: "CASH",
        status: "ACTIVE",
        currency: "TRY",
        name: "Kasa",
        balance: 100,
      },
      "c1",
      { amount: 500, checkBalance: true }
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(
        result.message,
        EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.insufficientBalance
      );
    }
  });

  it("prim için hesap zorunlu", () => {
    const result = validateEmployeePaymentCreateInput({
      type: "BONUS",
      amount: 1000,
      relatedAccountId: "",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, EMPLOYEE_PAYMENT_VALIDATION_MESSAGES.accountRequired);
    }
  });

  it("maaş bekleyen kayıt hesap olmadan oluşturulabilir", () => {
    const result = validateEmployeePaymentCreateInput({
      type: "SALARY",
      amount: 1000,
      relatedAccountId: "",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.payImmediately, false);
    }
  });

  it("hesap seçilirse anında ödeme", () => {
    const result = validateEmployeePaymentCreateInput({
      type: "SALARY",
      amount: 1000,
      relatedAccountId: "acc-1",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.payImmediately, true);
      assert.equal(result.accountId, "acc-1");
    }
  });
});
