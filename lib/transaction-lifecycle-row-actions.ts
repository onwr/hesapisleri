import type { EmployeePaymentStatus } from "@prisma/client";
import {
  mapEmployeePaymentStatusToLifecycle,
  resolveModuleLifecycleActions,
  type LifecycleActionMatrix,
  type TransactionLifecycleState,
  type TransactionModuleKey,
} from "@/lib/transaction-lifecycle-policy";
import {
  mapAccountTransactionToLifecycle,
  mapEmployeeLeaveToLifecycle,
  mapExpenseToLifecycle,
  mapInvoiceToLifecycle,
  mapSaleToLifecycle,
  mapWarehouseTransferToLifecycle,
} from "@/lib/transaction-lifecycle-enforcement";

export function getLifecycleRowActions(input: {
  module: TransactionModuleKey;
  state: TransactionLifecycleState;
}): LifecycleActionMatrix {
  return resolveModuleLifecycleActions(input);
}

export function getExpenseRowActions(input: {
  status: string;
  paymentStatus: string;
}) {
  return getLifecycleRowActions({
    module: "expenses",
    state: mapExpenseToLifecycle(input),
  });
}

export function getInvoiceRowActions(input: {
  status: string;
  paymentStatus: string;
  isEInvoice?: boolean;
}) {
  return getLifecycleRowActions({
    module: input.isEInvoice ? "e_invoices" : "invoices",
    state: mapInvoiceToLifecycle(input),
  });
}

export function getSaleRowActions(status: string) {
  return getLifecycleRowActions({
    module: "sales",
    state: mapSaleToLifecycle(status),
  });
}

export function getWarehouseTransferRowActions(status: string) {
  return getLifecycleRowActions({
    module: "stock_transfers",
    state: mapWarehouseTransferToLifecycle(status),
  });
}

export function getEmployeeLeaveRowActions(status: string) {
  return getLifecycleRowActions({
    module: "leaves",
    state: mapEmployeeLeaveToLifecycle(status),
  });
}

export function getEmployeePaymentRowActions(status: EmployeePaymentStatus) {
  return getLifecycleRowActions({
    module: "employee_payments",
    state: mapEmployeePaymentStatusToLifecycle(status),
  });
}

export function getAccountTransactionRowActions(input: {
  title: string;
  note?: string | null;
  isLinked: boolean;
}) {
  return getLifecycleRowActions({
    module: "cash_bank",
    state: mapAccountTransactionToLifecycle(input),
  });
}
