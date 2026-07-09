/**
 * Test-only transaction hooks for controlled rollback injection.
 * Production NODE_ENV never registers hooks; clear after each test.
 */

type TestHook = (() => void) | null;

let expenseCancelHook: TestHook = null;
let warehouseTransferCancelHook: TestHook = null;

function allowTestHooks() {
  return process.env.NODE_ENV !== "production";
}

export function setExpenseCancelTestHook(hook: TestHook) {
  if (!allowTestHooks()) return;
  expenseCancelHook = hook;
}

export function runExpenseCancelTestHook() {
  expenseCancelHook?.();
}

export function setWarehouseTransferCancelTestHook(hook: TestHook) {
  if (!allowTestHooks()) return;
  warehouseTransferCancelHook = hook;
}

export function runWarehouseTransferCancelTestHook() {
  warehouseTransferCancelHook?.();
}

export function clearAllTransactionTestHooks() {
  expenseCancelHook = null;
  warehouseTransferCancelHook = null;
}
