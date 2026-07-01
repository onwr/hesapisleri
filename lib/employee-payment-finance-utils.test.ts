import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMarkPaymentPaidApiResponse,
  buildMarkPaymentPaidFinanceResult,
  resolveEmployeePaymentFinancePlan,
  shouldShowMarkPaidButton,
  validateEmployeePaymentMarkPaidForm,
  validateMarkEmployeePaymentPaidInput,
} from "./employee-payment-finance-utils";

describe("employee payment finance utils", () => {
  it("resolveEmployeePaymentFinancePlan always plans expense+transaction when account provided", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: null,
      relatedTransactionId: null,
      relatedAccountId: "acc-1",
    });

    assert.equal(plan.createExpense, true);
    assert.equal(plan.createTransaction, true);
    assert.equal(plan.accountId, "acc-1");
  });

  it("already PAID → finans işlemi planlanmaz", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PAID",
      relatedExpenseId: "exp-1",
      relatedTransactionId: "tx-1",
      relatedAccountId: "acc-1",
    });

    assert.equal(plan.isAlreadyPaid, true);
    assert.equal(plan.createExpense, false);
    assert.equal(plan.createTransaction, false);
  });

  it("validateMarkEmployeePaymentPaidInput requires account for PAID", () => {
    const missing = validateMarkEmployeePaymentPaidInput({ status: "PAID" });
    assert.equal(missing.ok, false);

    const ok = validateMarkEmployeePaymentPaidInput({
      status: "PAID",
      relatedAccountId: "acc-1",
    });
    assert.equal(ok.ok, true);
  });

  it("validateMarkEmployeePaymentPaidInput requires account for payroll bulk", () => {
    const missing = validateMarkEmployeePaymentPaidInput({ requireAccount: true });
    assert.equal(missing.ok, false);

    const ok = validateMarkEmployeePaymentPaidInput({
      requireAccount: true,
      relatedAccountId: "acc-1",
    });
    assert.equal(ok.ok, true);
  });

  it("validateEmployeePaymentMarkPaidForm requires account", () => {
    assert.equal(
      validateEmployeePaymentMarkPaidForm({ relatedAccountId: "" }),
      "Ödeme yapılacak kasa veya banka hesabını seçin."
    );
    assert.equal(
      validateEmployeePaymentMarkPaidForm({ relatedAccountId: "acc-1" }),
      null
    );
  });

  it("buildMarkPaymentPaidApiResponse finance bloğu döner", () => {
    const response = buildMarkPaymentPaidApiResponse({
      payment: { id: "pay-1", status: "PAID" },
      finance: buildMarkPaymentPaidFinanceResult({
        expenseCreated: true,
        transactionCreated: true,
        relatedExpenseId: "exp-1",
        relatedTransactionId: "tx-1",
      }),
    });

    assert.equal(response.success, true);
    assert.equal(response.finance.transactionCreated, true);
  });

  it("shouldShowMarkPaidButton PAID satırda buton gizler", () => {
    assert.equal(shouldShowMarkPaidButton("PENDING"), true);
    assert.equal(shouldShowMarkPaidButton("PAID"), false);
  });
});
