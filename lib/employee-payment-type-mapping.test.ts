import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_PAYMENT_TYPE_BEHAVIOR,
  employeePaymentDisbursesCash,
  getEmployeePaymentTypeBehavior,
} from "./employee-payment-type-mapping";
import { calculatePayrollItemNetPayable } from "./payroll-utils";
import { calculateEmployeeBalance } from "./employee-utils";
import { calculateEmployeeAdvanceDebt, resolveLedgerDebitCredit } from "./employee-ledger-utils";

describe("employee payment type mapping", () => {
  it("maaş ödeme mapping kasa çıkışı gerektirir", () => {
    const behavior = getEmployeePaymentTypeBehavior("SALARY");
    assert.equal(behavior.label, "Maaş");
    assert.equal(behavior.requiresAccountToDisburse, true);
    assert.equal(behavior.allowPendingWithoutAccount, true);
    assert.equal(behavior.affectsPayableBalance, true);
  });

  it("avans mapping payable artırmaz, bordro mahsupuna dahil", () => {
    const behavior = getEmployeePaymentTypeBehavior("ADVANCE");
    assert.equal(behavior.label, "Çalışana Avans");
    assert.equal(behavior.affectsPayableBalance, false);
    assert.equal(behavior.countsTowardPayrollAdvance, true);
  });

  it("prim hesap seçimi zorunlu", () => {
    const behavior = getEmployeePaymentTypeBehavior("BONUS");
    assert.equal(behavior.requiresAccountToDisburse, true);
    assert.equal(behavior.allowPendingWithoutAccount, false);
  });

  it("kesinti kasa çıkışı gerektirmez", () => {
    assert.equal(employeePaymentDisbursesCash("DEDUCTION"), false);
  });

  it("netPayable = base + bonus - deduction - advance", () => {
    assert.equal(
      calculatePayrollItemNetPayable({
        baseSalary: 30000,
        bonusAmount: 1000,
        deductionAmount: 500,
        advanceDeduction: 2000,
      }),
      28500
    );
  });

  it("avans employee payable artırmaz", () => {
    const balance = calculateEmployeeBalance([
      {
        amount: 5000,
        status: "PAID",
        direction: "PAID",
        type: "ADVANCE",
      },
      {
        amount: 10000,
        status: "PENDING",
        direction: "PAYABLE",
        type: "SALARY",
      },
    ] as never);

    assert.equal(balance.totalPending, 10000);
    assert.equal(balance.totalPaid, 0);
    assert.equal(balance.netPayable, 10000);
  });

  it("ödenen avans cari mahsup (credit) üretir", () => {
    const { debit, credit } = resolveLedgerDebitCredit({
      type: "ADVANCE",
      status: "PAID",
      direction: "PAID",
      amount: 1500,
    });
    assert.equal(debit, 0);
    assert.equal(credit, 1500);
  });

  it("bekleyen avans cari tahakkuk üretmez", () => {
    const { debit, credit } = resolveLedgerDebitCredit({
      type: "ADVANCE",
      status: "PENDING",
      direction: "PAYABLE",
      amount: 1500,
    });
    assert.equal(debit, 0);
    assert.equal(credit, 0);
  });

  it("avans borcu hesaplanır", () => {
    const debt = calculateEmployeeAdvanceDebt([
      {
        amount: 2000,
        status: "PAID",
        type: "ADVANCE",
        direction: "PAID",
      },
      {
        amount: 500,
        status: "CANCELLED",
        type: "ADVANCE",
        direction: "PAID",
      },
    ]);
    assert.equal(debt, 2000);
  });

  it("tüm tipler mapping içinde", () => {
    const types = Object.keys(EMPLOYEE_PAYMENT_TYPE_BEHAVIOR);
    assert.ok(types.includes("SALARY"));
    assert.ok(types.includes("ADVANCE"));
    assert.ok(types.includes("BONUS"));
    assert.ok(types.includes("EXPENSE_REIMBURSEMENT"));
  });
});
