/**
 * Operasyonel entitlement politikası:
 * Üyelik planı limitleri ve özellik kilitleri kullanıcı işlemlerini engellemez.
 * Billing, abonelik, kullanım ölçümü ve admin entitlement kayıtları korunur.
 */

export const UNLIMITED_OPERATIONAL_LIMIT_CODES = [
  "MAX_WAREHOUSES",
  "MAX_PRODUCTS",
  "MAX_USERS",
  "MAX_MARKETPLACES",
  "MAX_COMPANIES",
  "MAX_EMPLOYEES",
  "MONTHLY_E_DOCUMENTS",
  "MONTHLY_OCR_SCANS",
  "MONTHLY_EXPORTS",
  "MONTHLY_API_REQUESTS",
  "MONTHLY_AUTOMATIONS",
  "STORAGE_MB",
] as const;

export const UNLIMITED_OPERATIONAL_FEATURE_CODES = [
  "MULTI_WAREHOUSE",
  "E_DOCUMENT",
  "MARKETPLACE",
  "MULTI_COMPANY",
  "POS",
  "SALES",
  "INVOICES",
  "REPORTS",
  "PAYROLL",
  "ADVANCED_REPORTS",
  "OCR",
  "EXPORT",
  "API_ACCESS",
] as const;

export type UnlimitedOperationalLimitCode =
  (typeof UNLIMITED_OPERATIONAL_LIMIT_CODES)[number];

export type UnlimitedOperationalFeatureCode =
  (typeof UNLIMITED_OPERATIONAL_FEATURE_CODES)[number];

const UNLIMITED_LIMIT_SET = new Set<string>(UNLIMITED_OPERATIONAL_LIMIT_CODES);
const UNLIMITED_FEATURE_SET = new Set<string>(UNLIMITED_OPERATIONAL_FEATURE_CODES);

export function isUnlimitedOperationalLimitCode(code: string) {
  return UNLIMITED_LIMIT_SET.has(code);
}

export function isUnlimitedOperationalFeatureCode(code: string) {
  return UNLIMITED_FEATURE_SET.has(code);
}

/** Plan limitleri operasyonel olarak sınırsız değerlendirilir. */
export function isOperationalLimitEnforcementEnabled(_code: string) {
  return false;
}

/** Plan özellik kilitleri operasyonel olarak uygulanmaz. */
export function isOperationalFeatureEnforcementEnabled(_code: string) {
  return false;
}

export type NonBlockingEntitlementStatus = {
  featureEnabled: boolean;
  limitReached: boolean;
  message: string | null;
};

export function buildNonBlockingEntitlementStatus(): NonBlockingEntitlementStatus {
  return {
    featureEnabled: true,
    limitReached: false,
    message: null,
  };
}

export type OperationalLimitCheckResult = {
  allowed: true;
  limit: null;
  usage: number;
  remaining: null;
  isOverLimit: false;
  canCreate: true;
};

export function buildUnlimitedLimitCheckResult(usage = 0): OperationalLimitCheckResult {
  return {
    allowed: true,
    limit: null,
    usage,
    remaining: null,
    isOverLimit: false,
    canCreate: true,
  };
}
