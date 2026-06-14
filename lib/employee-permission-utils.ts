import type { PermissionRole } from "@/lib/permission-utils";
import {
  canAccessEmployees,
  canManageEmployees,
  canManagePayrollRuns,
  canManagePerformanceTargets,
  canManageUsers,
  canProcessEmployeePayments,
} from "@/lib/permission-utils";

export type EmployeeApiPermission =
  | "view"
  | "manageRecords"
  | "manageSalary"
  | "managePayroll"
  | "processPayments"
  | "manageTargets";

export type EmployeeModulePermissions = {
  canView: boolean;
  canManageRecords: boolean;
  canManageUsers: boolean;
  canManagePayroll: boolean;
  canProcessPayments: boolean;
  canManageTargets: boolean;
  isReadOnlyViewer: boolean;
};

export function getEmployeeModulePermissions(
  role: PermissionRole,
  isOwner = false
): EmployeeModulePermissions {
  const canView = canAccessEmployees(role, isOwner);
  const canManageRecords = canManageEmployees(role, isOwner);

  return {
    canView,
    canManageRecords,
    canManageUsers: canManageUsers(role, isOwner),
    canManagePayroll: canManagePayrollRuns(role, isOwner),
    canProcessPayments: canProcessEmployeePayments(role, isOwner),
    canManageTargets: canManagePerformanceTargets(role, isOwner),
    isReadOnlyViewer: canView && !canManageRecords,
  };
}

export function hasEmployeeApiPermission(
  role: PermissionRole,
  permission: EmployeeApiPermission,
  isOwner = false
) {
  switch (permission) {
    case "view":
      return canAccessEmployees(role, isOwner);
    case "manageRecords":
    case "manageSalary":
      return canManageEmployees(role, isOwner);
    case "managePayroll":
      return canManagePayrollRuns(role, isOwner);
    case "processPayments":
      return canProcessEmployeePayments(role, isOwner);
    case "manageTargets":
      return canManagePerformanceTargets(role, isOwner);
    default:
      return false;
  }
}
