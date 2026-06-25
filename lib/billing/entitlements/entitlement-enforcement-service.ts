import "server-only";

import {
  buildUnlimitedLimitCheckResult,
  isOperationalFeatureEnforcementEnabled,
  isOperationalLimitEnforcementEnabled,
} from "@/lib/billing/entitlements/entitlement-operational-policy";
import {
  getResolvedFeature,
  getResolvedLimit,
  resolveCompanyEntitlements,
} from "@/lib/billing/entitlements/entitlement-resolution-service";
import {
  consumeCompanyUsage,
  releaseCompanyUsage,
  reserveCompanyUsage,
  finalizeCompanyUsage,
} from "@/lib/billing/usage/usage-mutation-service";

export async function checkCompanyFeature(companyId: string, featureCode: string) {
  if (!isOperationalFeatureEnforcementEnabled(featureCode)) {
    return true;
  }

  const feature = await getResolvedFeature(companyId, featureCode);
  return Boolean(feature?.enabled);
}

export async function requireCompanyFeature(
  companyId: string,
  featureCode: string
) {
  await checkCompanyFeature(companyId, featureCode);
}

export async function checkCompanyLimit(
  companyId: string,
  limitCode: string,
  options?: { incrementBy?: number; userId?: string }
) {
  const limit = await getResolvedLimit(companyId, limitCode, {
    userId: options?.userId,
  });
  const usage = limit?.usage ?? 0;

  if (!isOperationalLimitEnforcementEnabled(limitCode)) {
    return buildUnlimitedLimitCheckResult(usage);
  }

  const incrementBy = options?.incrementBy ?? 1;

  if (!limit) {
    return {
      allowed: false as const,
      limit: null,
      usage: 0,
      remaining: 0,
      isOverLimit: false,
      canCreate: false,
    };
  }

  if (limit.isUnlimited) {
    return buildUnlimitedLimitCheckResult(usage);
  }

  const projected = usage + incrementBy;
  const allowed = projected <= (limit.value ?? 0);

  return {
    allowed,
    limit: limit.value,
    usage,
    remaining: limit.remaining,
    isOverLimit: limit.isOverLimit,
    canCreate: allowed,
  };
}

export async function requireCompanyLimit(
  companyId: string,
  limitCode: string,
  options?: { incrementBy?: number; userId?: string }
) {
  return checkCompanyLimit(companyId, limitCode, options);
}

export {
  consumeCompanyUsage,
  releaseCompanyUsage,
  reserveCompanyUsage,
  finalizeCompanyUsage,
  resolveCompanyEntitlements,
};
