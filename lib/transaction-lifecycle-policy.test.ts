import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canCancelByLifecycleState,
  canEditByLifecycleState,
  canHardDeleteByLifecycleState,
  isFinanciallyFinalizedState,
  mapEmployeePaymentStatusToLifecycle,
  requiresCancelReason,
  resolveModuleLifecycleActions,
} from "./transaction-lifecycle-policy";

describe("transaction-lifecycle-policy", () => {
  it("pending employee payment düzenlenebilir ve iptal edilebilir", () => {
    const actions = resolveModuleLifecycleActions({
      module: "employee_payments",
      state: "PENDING",
    });
    assert.equal(actions.edit, true);
    assert.equal(actions.cancel, true);
    assert.equal(actions.delete, true);
  });

  it("paid employee payment hard delete edilemez, iptal/ters kayıt gerekir", () => {
    const actions = resolveModuleLifecycleActions({
      module: "employee_payments",
      state: "PAID",
    });
    assert.equal(actions.delete, false);
    assert.equal(actions.cancel, true);
    assert.equal(actions.reverse, true);
    assert.equal(requiresCancelReason("PAID"), true);
  });

  it("stock movement hard delete reddedilir", () => {
    const actions = resolveModuleLifecycleActions({
      module: "stock_movements",
      state: "POSTED",
    });
    assert.equal(actions.delete, false);
    assert.equal(actions.view, true);
  });

  it("payroll paid hard delete yok", () => {
    const actions = resolveModuleLifecycleActions({
      module: "payroll",
      state: "PAID",
    });
    assert.equal(actions.delete, false);
    assert.equal(actions.cancel, false);
  });

  it("lifecycle yardımcıları tutarlı", () => {
    assert.equal(canEditByLifecycleState("DRAFT"), true);
    assert.equal(canEditByLifecycleState("PAID"), false);
    assert.equal(canHardDeleteByLifecycleState("DRAFT"), true);
    assert.equal(canHardDeleteByLifecycleState("COMPLETED"), false);
    assert.equal(canCancelByLifecycleState("CANCELLED"), false);
    assert.equal(isFinanciallyFinalizedState("POSTED"), true);
    assert.equal(mapEmployeePaymentStatusToLifecycle("OVERDUE"), "OVERDUE");
  });
});
