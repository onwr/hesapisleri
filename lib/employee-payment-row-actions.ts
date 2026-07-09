import type { EmployeePaymentStatus } from "@prisma/client";
import {
  mapEmployeePaymentStatusToLifecycle,
  resolveModuleLifecycleActions,
} from "@/lib/transaction-lifecycle-policy";

export function getEmployeePaymentRowActions(status: EmployeePaymentStatus) {
  const lifecycle = mapEmployeePaymentStatusToLifecycle(status);
  return resolveModuleLifecycleActions({
    module: "employee_payments",
    state: lifecycle,
  });
}
