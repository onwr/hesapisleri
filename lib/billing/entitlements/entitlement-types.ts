import type { PlanEntitlementValueType } from "@prisma/client";

export type EntitlementCategory =
  | "CORE_MODULES"
  | "FINANCE"
  | "INVENTORY"
  | "HR"
  | "INTEGRATIONS"
  | "REPORTING"
  | "AI_AUTOMATION"
  | "SUPPORT_PLATFORM";

export type EntitlementResetPeriod = "NONE" | "MONTHLY" | "BILLING_PERIOD";

export type EntitlementKind = "FEATURE" | "LIMIT";

export type EntitlementSource =
  | "PLAN"
  | "TRIAL"
  | "ADDON"
  | "OVERRIDE"
  | "USAGE_PACK";

export type EntitlementRegistryEntry = {
  code: string;
  label: string;
  description: string;
  category: EntitlementCategory;
  kind: EntitlementKind;
  valueType: PlanEntitlementValueType;
  unit?: string;
  metered: boolean;
  resetPeriod: EntitlementResetPeriod;
  defaultBehavior: "DENY" | "ALLOW" | "ZERO";
  blockingBehavior: "BLOCK_CREATE" | "READ_ONLY" | "NONE";
};

export type EntitlementContribution = {
  source: EntitlementSource;
  sourceId?: string;
  valueType: PlanEntitlementValueType;
  booleanValue?: boolean | null;
  numberValue?: number | null;
  stringValue?: string | null;
  isUnlimited?: boolean;
  label?: string;
};

export type ResolvedBooleanEntitlement = {
  code: string;
  kind: "FEATURE";
  enabled: boolean;
  source: EntitlementSource;
  sources: EntitlementContribution[];
};

export type ResolvedLimitEntitlement = {
  code: string;
  kind: "LIMIT";
  value: number | null;
  isUnlimited: boolean;
  usage: number;
  reserved: number;
  remaining: number | null;
  overBy: number;
  isOverLimit: boolean;
  canCreate: boolean;
  source: EntitlementSource;
  sources: EntitlementContribution[];
  resetsAt?: string | null;
  breakdown: {
    plan: number;
    addon: number;
    override: number;
    usagePack: number;
  };
};

export type ResolvedEntitlement = ResolvedBooleanEntitlement | ResolvedLimitEntitlement;

export type CompanyEntitlementsResult = {
  companyId: string;
  resolvedAt: string;
  entitlements: Record<string, ResolvedEntitlement>;
};

export type PlanEntitlementInput = {
  code: string;
  valueType: PlanEntitlementValueType;
  booleanValue?: boolean | null;
  numberValue?: number | null;
  stringValue?: string | null;
  isUnlimited?: boolean;
  description?: string | null;
  category?: string | null;
  sortOrder?: number;
};
