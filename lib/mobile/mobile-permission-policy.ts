export type MobileModule =
  | "dashboard"
  | "sales"
  | "products"
  | "customers"
  | "invoices"
  | "expenses"
  | "orders"
  | "suppliers"
  | "employees"
  | "reports"
  | "settings"
  | "company";

export type MobileAction = "read" | "write" | "delete" | "admin";

export const ROLE_PERMISSIONS: Record<string, Record<MobileModule, MobileAction[]>> = {
  OWNER: {
    dashboard: ["read"],
    sales: ["read", "write", "delete"],
    products: ["read", "write", "delete"],
    customers: ["read", "write", "delete"],
    invoices: ["read", "write", "delete"],
    expenses: ["read", "write", "delete"],
    orders: ["read", "write", "delete"],
    suppliers: ["read", "write"],
    employees: ["read", "write"],
    reports: ["read"],
    settings: ["read", "write", "admin"],
    company: ["read", "write", "admin"],
  },
  ADMIN: {
    dashboard: ["read"],
    sales: ["read", "write", "delete"],
    products: ["read", "write", "delete"],
    customers: ["read", "write", "delete"],
    invoices: ["read", "write", "delete"],
    expenses: ["read", "write", "delete"],
    orders: ["read", "write", "delete"],
    suppliers: ["read", "write"],
    employees: ["read", "write"],
    reports: ["read"],
    settings: ["read", "write"],
    company: ["read"],
  },
  ACCOUNTANT: {
    dashboard: ["read"],
    sales: ["read"],
    products: ["read"],
    customers: ["read"],
    invoices: ["read", "write"],
    expenses: ["read", "write"],
    orders: [],
    suppliers: ["read"],
    employees: ["read"],
    reports: ["read"],
    settings: [],
    company: ["read"],
  },
  STAFF: {
    dashboard: ["read"],
    sales: ["read", "write"],
    products: ["read"],
    customers: ["read", "write"],
    invoices: ["read"],
    expenses: [],
    orders: ["read", "write"],
    suppliers: ["read"],
    employees: [],
    reports: [],
    settings: [],
    company: ["read"],
  },
  POS_STAFF: {
    dashboard: ["read"],
    sales: ["read", "write"],
    products: ["read"],
    customers: ["read"],
    invoices: [],
    expenses: [],
    orders: [],
    suppliers: [],
    employees: [],
    reports: [],
    settings: [],
    company: [],
  },
};

export function mobileRoleAllows(
  role: string,
  module: MobileModule,
  action: MobileAction
): boolean {
  return (ROLE_PERMISSIONS[role]?.[module] ?? []).includes(action);
}
