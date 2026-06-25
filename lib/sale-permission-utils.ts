import type { PermissionRole } from "@/lib/permission-utils";
import { resolveEffectiveRole } from "@/lib/permission-utils";

const SALES_UPDATE_ROLES: PermissionRole[] = ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"];
const SALES_CANCEL_ROLES: PermissionRole[] = ["OWNER", "ADMIN", "ACCOUNTANT", "SUPER_ADMIN"];

function hasSalesActionRole(
  role: PermissionRole,
  allowed: PermissionRole[],
  isOwner = false
) {
  const effective = resolveEffectiveRole({ role, isOwner });
  return allowed.includes(effective);
}

export function canUpdateSales(role: PermissionRole, isOwner = false) {
  return hasSalesActionRole(role, SALES_UPDATE_ROLES, isOwner);
}

export function canCancelSales(role: PermissionRole, isOwner = false) {
  return hasSalesActionRole(role, SALES_CANCEL_ROLES, isOwner);
}
