import type { UserRole } from "@prisma/client";
import { canAccessModule } from "@/lib/permission-utils";
import { mobileRoleAllows } from "./mobile-permission-policy";

export type MobileCatalogPermissions = {
  products: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    viewCostPrice: boolean;
  };
  stocks: {
    read: boolean;
    adjust: boolean;
    transfer: boolean;
  };
  customers: {
    read: boolean;
    create: boolean;
    update: boolean;
    viewBalance: boolean;
    viewDebtFilters: boolean;
  };
  warehouses: {
    read: boolean;
    manage: boolean;
  };
};

export function resolveMobileCatalogPermissions(
  role: string,
  isOwner: boolean
): MobileCatalogPermissions {
  const roleKey = role as UserRole;
  const canStocks = canAccessModule(roleKey, "stocks", isOwner);
  const canInvoices = canAccessModule(roleKey, "invoices", isOwner);
  const canReports = canAccessModule(roleKey, "reports", isOwner);
  const canWarehouses = canAccessModule(roleKey, "stocks", isOwner);

  return {
    products: {
      read: mobileRoleAllows(role, "products", "read"),
      create: mobileRoleAllows(role, "products", "write"),
      update: mobileRoleAllows(role, "products", "write"),
      delete: mobileRoleAllows(role, "products", "delete"),
      viewCostPrice:
        mobileRoleAllows(role, "products", "write") || canReports,
    },
    stocks: {
      read: canStocks,
      adjust: canStocks && mobileRoleAllows(role, "products", "write"),
      transfer: canStocks && mobileRoleAllows(role, "products", "write"),
    },
    customers: {
      read: mobileRoleAllows(role, "customers", "read"),
      create: mobileRoleAllows(role, "customers", "write"),
      update: mobileRoleAllows(role, "customers", "write"),
      viewBalance: canInvoices,
      viewDebtFilters: canInvoices,
    },
    warehouses: {
      read: canWarehouses,
      manage: canAccessModule(roleKey, "stocks", isOwner) && isOwner,
    },
  };
}
