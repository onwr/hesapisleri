import type { UserRole } from "@prisma/client";

export type PermissionRole = UserRole;

export type AppModule =
  | "dashboard"
  | "pos"
  | "sales"
  | "customers"
  | "products"
  | "stocks"
  | "invoices"
  | "cash-bank"
  | "expenses"
  | "orders"
  | "reports"
  | "ai-assistant"
  | "notifications"
  | "settings"
  | "settings-users"
  | "admin";

const FULL_ACCESS_ROLES: PermissionRole[] = [
  "OWNER",
  "ADMIN",
  "SUPER_ADMIN",
];

const MODULE_ACCESS: Record<AppModule, PermissionRole[]> = {
  dashboard: ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"],
  pos: ["OWNER", "ADMIN", "STAFF", "SUPER_ADMIN"],
  sales: ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"],
  customers: ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"],
  products: ["OWNER", "ADMIN", "STAFF", "SUPER_ADMIN"],
  stocks: ["OWNER", "ADMIN", "STAFF", "SUPER_ADMIN"],
  invoices: ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"],
  "cash-bank": ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"],
  expenses: ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"],
  orders: ["OWNER", "ADMIN", "STAFF", "SUPER_ADMIN"],
  reports: ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"],
  "ai-assistant": ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"],
  notifications: ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"],
  settings: ["OWNER", "ADMIN", "ACCOUNTANT", "STAFF", "SUPER_ADMIN"],
  "settings-users": ["OWNER", "ADMIN", "SUPER_ADMIN"],
  admin: ["SUPER_ADMIN"],
};

export function resolveEffectiveRole(input: {
  role: PermissionRole;
  isOwner?: boolean;
}): PermissionRole {
  if (input.isOwner) {
    return "OWNER";
  }

  return input.role;
}

function getEffectiveRole(role: PermissionRole, isOwner = false) {
  return resolveEffectiveRole({ role, isOwner });
}

function hasRoleAccess(
  role: PermissionRole,
  allowed: PermissionRole[],
  isOwner = false
) {
  const effective = getEffectiveRole(role, isOwner);
  return allowed.includes(effective);
}

export function canAccessModule(
  role: PermissionRole,
  module: AppModule,
  isOwner = false
) {
  if (module === "admin") {
    return role === "SUPER_ADMIN";
  }

  return hasRoleAccess(role, MODULE_ACCESS[module], isOwner);
}

export function getAccessibleModules(
  role: PermissionRole,
  isOwner = false
): AppModule[] {
  return (Object.keys(MODULE_ACCESS) as AppModule[]).filter((module) =>
    canAccessModule(role, module, isOwner)
  );
}

export function canManageUsers(role: PermissionRole, isOwner = false) {
  return canAccessModule(role, "settings-users", isOwner);
}

export function canManageSettings(role: PermissionRole, isOwner = false) {
  const effective = getEffectiveRole(role, isOwner);
  return (
    effective === "OWNER" ||
    effective === "ADMIN" ||
    effective === "SUPER_ADMIN"
  );
}

export function canAccessFinance(role: PermissionRole, isOwner = false) {
  return (
    canAccessModule(role, "cash-bank", isOwner) &&
    canAccessModule(role, "expenses", isOwner)
  );
}

export function canAccessPOS(role: PermissionRole, isOwner = false) {
  return canAccessModule(role, "pos", isOwner);
}

export function canAccessReports(role: PermissionRole, isOwner = false) {
  return canAccessModule(role, "reports", isOwner);
}

export function canManageProducts(role: PermissionRole, isOwner = false) {
  return canAccessModule(role, "products", isOwner);
}

export function canManageInvoices(role: PermissionRole, isOwner = false) {
  return canAccessModule(role, "invoices", isOwner);
}

export function isOwnerRole(role: PermissionRole, isOwner = false) {
  return getEffectiveRole(role, isOwner) === "OWNER";
}

export function isFullAccessRole(role: PermissionRole, isOwner = false) {
  return hasRoleAccess(role, FULL_ACCESS_ROLES, isOwner);
}
