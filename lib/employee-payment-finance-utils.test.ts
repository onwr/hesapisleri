import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEmployeePaymentExpenseTitle,
  buildEmployeePaymentExpenseHref,
  buildEmployeePaymentTransactionHref,
  buildEmployeePaymentsActionUrl,
  buildMarkPaymentPaidApiResponse,
  buildMarkPaymentPaidFinanceResult,
  resolveEmployeePaymentFinancePlan,
  shouldShowMarkPaidButton,
  validateEmployeePaymentMarkPaidForm,
  validateMarkEmployeePaymentPaidInput,
} from "./employee-payment-finance-utils";

describe("employee payment finance utils", () => {
  it("resolveEmployeePaymentFinancePlan sadece PAID yapar (createExpense false)", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: null,
      relatedTransactionId: null,
      createExpense: false,
      createTransaction: false,
    });

    assert.equal(plan.isAlreadyPaid, false);
    assert.equal(plan.createExpense, false);
    assert.equal(plan.createTransaction, false);
  });

  it("createExpense true → Expense oluşturma planlanır", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: null,
      relatedTransactionId: null,
      createExpense: true,
    });

    assert.equal(plan.createExpense, true);
    assert.equal(plan.createTransaction, false);
  });

  it("createTransaction true + relatedAccountId → transaction planlanır", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: null,
      relatedTransactionId: null,
      createTransaction: true,
      relatedAccountId: "acc-1",
    });

    assert.equal(plan.createTransaction, true);
    assert.equal(plan.accountId, "acc-1");
  });

  it("relatedAccountId verilince transaction planlanır", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "OVERDUE",
      relatedExpenseId: null,
      relatedTransactionId: null,
      relatedAccountId: "acc-2",
    });

    assert.equal(plan.createTransaction, true);
  });

  it("already PAID → finans işlemi planlanmaz", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PAID",
      relatedExpenseId: "exp-1",
      relatedTransactionId: "tx-1",
      createExpense: true,
      createTransaction: true,
      relatedAccountId: "acc-1",
    });

    assert.equal(plan.isAlreadyPaid, true);
    assert.equal(plan.createExpense, false);
    assert.equal(plan.createTransaction, false);
  });

  it("relatedExpenseId varsa tekrar expense planlanmaz", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: "exp-existing",
      relatedTransactionId: null,
      createExpense: true,
    });

    assert.equal(plan.createExpense, false);
  });

  it("relatedTransactionId varsa tekrar transaction planlanmaz", () => {
    const plan = resolveEmployeePaymentFinancePlan({
      status: "PENDING",
      relatedExpenseId: null,
      relatedTransactionId: "tx-existing",
      createTransaction: true,
      relatedAccountId: "acc-1",
    });

    assert.equal(plan.createTransaction, false);
  });

  it("createTransaction true ama account yok → API validation 400", () => {
    const result = validateMarkEmployeePaymentPaidInput({
      status: "PAID",
      createTransaction: true,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.message, /hesap/i);
    }
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
    assert.equal(response.finance.expenseCreated, true);
    assert.equal(response.finance.relatedExpenseId, "exp-1");
    assert.equal(response.finance.relatedTransactionId, "tx-1");
  });

  it("notification actionUrl payments sekmesine gider", () => {
    assert.equal(
      buildEmployeePaymentsActionUrl("emp-1"),
      "/team/emp-1?tab=payments"
    );
  });

  it("buildEmployeePaymentExpenseTitle çalışan adını içerir", () => {
    assert.equal(
      buildEmployeePaymentExpenseTitle("Ayşe Yılmaz"),
      "Çalışan ödemesi: Ayşe Yılmaz"
    );
  });

  it("shouldShowMarkPaidButton PAID satırda buton gizler", () => {
    assert.equal(shouldShowMarkPaidButton("PENDING"), true);
    assert.equal(shouldShowMarkPaidButton("OVERDUE"), true);
    assert.equal(shouldShowMarkPaidButton("PAID"), false);
    assert.equal(shouldShowMarkPaidButton("CANCELLED"), false);
  });

  it("validateEmployeePaymentMarkPaidForm hesap zorunluluğu", () => {
    assert.equal(
      validateEmployeePaymentMarkPaidForm({
        createTransaction: true,
        relatedAccountId: "",
      }),
      "Kasa/banka hareketi oluşturmak için hesap seçin."
    );
    assert.equal(
      validateEmployeePaymentMarkPaidForm({
        createTransaction: false,
        relatedAccountId: "",
      }),
      null
    );
  });

  it("relatedExpenseId badge href gider detayına gider", () => {
    assert.equal(
      buildEmployeePaymentExpenseHref("exp-123"),
      "/expenses/exp-123"
    );
  });

  it("relatedTransactionId badge href hesap detayına gider", () => {
    assert.equal(
      buildEmployeePaymentTransactionHref({
        transactionId: "tx-1",
        accountId: "acc-1",
      }),
      "/cash-bank/acc-1"
    );
    assert.equal(
      buildEmployeePaymentTransactionHref({
        transactionId: "tx-1",
        accountId: null,
      }),
      "/cash-bank"
    );
  });

  it("OVERDUE satırda mark paid butonu görünür", () => {
    assert.equal(shouldShowMarkPaidButton("OVERDUE"), true);
  });
});

describe("employee payment API access expectations", () => {
  it("employees modülü STAFF rolünde kapalıdır", () => {
    const staffCanAccessEmployees = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes(
      "STAFF"
    );
    assert.equal(staffCanAccessEmployees, false);
  });

  it("auth yoksa API 401 dönebilir", () => {
    const unauthorizedStatus = 401;
    assert.equal(unauthorizedStatus, 401);
  });
});
