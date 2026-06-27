import type { SystemLogResult, SystemLogSource } from "@/lib/admin/system-logs/system-log-types";

export const ENTITY_ADMIN_ROUTES: Record<string, (id: string) => string> = {
  MembershipPlan: (id) => `/admin/plans/${id}`,
  MembershipPayment: (id) => `/admin/payments/${id}`,
  CompanySubscription: (id) => `/admin/subscriptions/${id}`,
  Company: (id) => `/admin/companies/${id}`,
  User: (id) => `/admin/users/${id}`,
  PartnerProfile: (id) => `/admin/partners/${id}`,
  PartnerApplication: (id) => `/admin/partners/applications/${id}`,
  PartnerPayout: (id) => `/admin/partners/payouts/${id}`,
  MembershipCampaign: (id) => `/admin/campaigns/${id}`,
  MembershipCoupon: (id) => `/admin/coupons/${id}`,
  MembershipAddOn: (id) => `/admin/add-ons/${id}`,
};

const ADMIN_MODULE_PREFIX = "admin-";

const PAYMENT_MODULES = new Set([
  "admin-payments",
  "admin-subscriptions",
  "admin-billing",
  "payments",
  "membership",
]);

const PARTNER_MODULE_PREFIXES = ["admin-partner", "admin-partners"];

const SECURITY_ACTIONS = new Set([
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "PASSWORD_RESET",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_CHANGED",
  "MFA_ENABLED",
  "MFA_DISABLED",
  "SESSION_REVOKED",
  "UNAUTHORIZED_ACCESS",
]);

type LogClassifyInput = {
  module: string;
  action: string;
  userId: string | null;
  companyId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
};

function parseMetadataObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

function metadataSource(meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  const source = meta.source;
  return typeof source === "string" ? source.toLowerCase() : null;
}

export function isStructuredLog(row: Pick<LogClassifyInput, "entityType" | "entityId">): boolean {
  return Boolean(row.entityType?.trim() && row.entityId?.trim());
}

export function isLegacyLog(row: Pick<LogClassifyInput, "entityType" | "entityId">): boolean {
  return !isStructuredLog(row);
}

export function classifyLogSource(row: LogClassifyInput): SystemLogSource {
  const module = row.module.toLowerCase();
  const action = row.action.toUpperCase();
  const meta = parseMetadataObject(row.metadata);
  const metaSrc = metadataSource(meta);

  if (
    module.includes("cron") ||
    action.includes("CRON") ||
    metaSrc?.includes("cron") ||
    metaSrc?.includes("lifecycle-cron")
  ) {
    return "CRON";
  }

  if (module === "admin" || module.startsWith(ADMIN_MODULE_PREFIX)) {
    return "ADMIN";
  }

  if (row.companyId && !module.startsWith(ADMIN_MODULE_PREFIX) && module !== "admin") {
    return "TENANT";
  }

  if (!row.userId) {
    return "SYSTEM";
  }

  return row.companyId ? "TENANT" : "ADMIN";
}

export function classifyLogResult(row: LogClassifyInput): SystemLogResult {
  const action = row.action.toUpperCase();
  const meta = parseMetadataObject(row.metadata);

  if (
    action.includes("FAIL") ||
    action.includes("ERROR") ||
    action.endsWith("_FAILED")
  ) {
    return "error";
  }

  if (meta) {
    if (meta.success === false) return "error";
    if (meta.error != null && meta.error !== "") return "error";
    if (meta.result === "error" || meta.result === "failed") return "error";
    if (meta.success === true || meta.result === "success" || meta.result === "ok") {
      return "success";
    }
  }

  if (action.includes("SUCCESS") || action.includes("COMPLETED")) {
    return "success";
  }

  return "unknown";
}

export function isSecurityAuthEvent(row: Pick<LogClassifyInput, "module" | "action">): boolean {
  const module = row.module.toLowerCase();
  const action = row.action.toUpperCase();
  if (module === "auth" || module.includes("auth")) return true;
  return SECURITY_ACTIONS.has(action) || action.includes("PASSWORD") || action.includes("LOGIN");
}

export function isPaymentBillingEvent(row: Pick<LogClassifyInput, "module" | "action">): boolean {
  const module = row.module.toLowerCase();
  if (PAYMENT_MODULES.has(module) || module.includes("payment") || module.includes("subscription")) {
    return true;
  }
  const action = row.action.toUpperCase();
  return action.includes("PAYMENT") || action.includes("BILLING") || action.includes("REFUND");
}

export function isPartnerEvent(row: Pick<LogClassifyInput, "module">): boolean {
  const module = row.module.toLowerCase();
  return PARTNER_MODULE_PREFIXES.some((p) => module.startsWith(p));
}

export function resolveEntityAdminHref(
  entityType: string | null,
  entityId: string | null
): string | null {
  if (!entityType?.trim() || !entityId?.trim()) return null;
  const builder = ENTITY_ADMIN_ROUTES[entityType];
  return builder ? builder(entityId) : null;
}

export function shortenEntityId(entityId: string | null | undefined, max = 14): string | null {
  if (!entityId?.trim()) return null;
  if (entityId.length <= max) return entityId;
  return `${entityId.slice(0, 8)}…${entityId.slice(-4)}`;
}
