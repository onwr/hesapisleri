import type { UserRole } from "@prisma/client";
import { canAccessModule, canManageAccounts } from "@/lib/permission-utils";
import { mobileRoleAllows } from "./mobile-permission-policy";

export type MobileFinancePermissions = {
  invoices: {
    read: boolean;
    create: boolean;
    cancel: boolean;
  };
  collections: {
    read: boolean;
    create: boolean;
  };
  finance: {
    read: boolean;
    viewBalance: boolean;
    transfer: boolean;
  };
  expenses: {
    read: boolean;
    create: boolean;
    update: boolean;
    cancel: boolean;
  };
  suppliers: {
    read: boolean;
    viewBalance: boolean;
  };
};

export function resolveMobileFinancePermissions(
  role: string,
  isOwner: boolean
): MobileFinancePermissions {
  const roleKey = role as UserRole;
  const canInvoices = canAccessModule(roleKey, "invoices", isOwner);
  const canCashBank = canAccessModule(roleKey, "cash-bank", isOwner);
  const canExpenses = canAccessModule(roleKey, "expenses", isOwner);
  const canSuppliers = canAccessModule(roleKey, "suppliers", isOwner);

  return {
    invoices: {
      read: canInvoices && mobileRoleAllows(role, "invoices", "read"),
      create: canInvoices && mobileRoleAllows(role, "invoices", "write"),
      cancel: canInvoices && mobileRoleAllows(role, "invoices", "delete"),
    },
    collections: {
      read: canInvoices && mobileRoleAllows(role, "invoices", "read"),
      create: canInvoices && mobileRoleAllows(role, "invoices", "write"),
    },
    finance: {
      read: canCashBank,
      viewBalance: canCashBank,
      transfer:
        canCashBank &&
        canManageAccounts(roleKey, isOwner) &&
        mobileRoleAllows(role, "settings", "write"),
    },
    expenses: {
      read: canExpenses && mobileRoleAllows(role, "expenses", "read"),
      create: canExpenses && mobileRoleAllows(role, "expenses", "write"),
      update: canExpenses && mobileRoleAllows(role, "expenses", "write"),
      cancel: canExpenses && mobileRoleAllows(role, "expenses", "delete"),
    },
    suppliers: {
      read: canSuppliers,
      viewBalance: canExpenses,
    },
  };
}
