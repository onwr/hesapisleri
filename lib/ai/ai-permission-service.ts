import type { AppModule } from "@/lib/permission-utils";
import { canAccessModule, type PermissionRole } from "@/lib/permission-utils";
import { AiServiceError } from "@/lib/ai/ai-errors";
import { WRITE_ACTION_TOOL_NAMES } from "@/lib/ai/ai-config";

export type AiPermissionContext = {
  companyId: string;
  userId: string;
  effectiveRole: PermissionRole;
  isOwner: boolean;
  readOnlyMode: boolean;
};

const TOOL_MODULE_MAP: Record<string, AppModule | AppModule[]> = {
  getDashboardSummary: "dashboard",
  getSalesSummary: "sales",
  getTopProducts: ["sales", "products"],
  getLowStockProducts: ["stocks", "products"],
  getDeadStockProducts: ["stocks", "products"],
  getCashFlowSummary: "cash-bank",
  getAccountBalances: "cash-bank",
  getExpenseSummary: "expenses",
  getOverdueInvoices: "invoices",
  getUpcomingCollections: ["invoices", "cash-bank"],
  getCustomerBalance: "customers",
  getCustomerSalesSummary: ["customers", "sales"],
  getSupplierSummary: "suppliers",
  getEmployeePaymentSummary: "employees",
  getMarketplaceSummary: "settings",
  getCalendarSummary: "calendar",
  getNotificationSummary: "notifications",
};

export function assertToolPermission(toolName: string, ctx: AiPermissionContext) {
  if (WRITE_ACTION_TOOL_NAMES.has(toolName)) {
    throw new AiServiceError("READ_ONLY_VIOLATION", 403);
  }

  const module = TOOL_MODULE_MAP[toolName];
  if (!module) {
    throw new AiServiceError("TOOL_NOT_ALLOWED", 403);
  }

  const modules = Array.isArray(module) ? module : [module];
  const allowed = modules.some((entry) =>
    canAccessModule(ctx.effectiveRole, entry, ctx.isOwner)
  );

  if (!allowed) {
    throw new AiServiceError("PERMISSION_DENIED", 403);
  }
}

export function canViewAiUsageStats(role: PermissionRole, isOwner: boolean) {
  return canAccessModule(role, "settings", isOwner);
}
