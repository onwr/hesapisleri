import "server-only";

import {
  FeatureDisabledError,
  LimitReachedError,
} from "@/lib/billing/entitlements/entitlement-errors";
import {
  getResolvedFeature,
  getResolvedLimit,
  resolveCompanyEntitlements,
} from "@/lib/billing/entitlements/entitlement-resolution-service";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import {
  consumeCompanyUsage,
  releaseCompanyUsage,
  reserveCompanyUsage,
  finalizeCompanyUsage,
} from "@/lib/billing/usage/usage-mutation-service";

export async function checkCompanyFeature(companyId: string, featureCode: string) {
  const feature = await getResolvedFeature(companyId, featureCode);
  return Boolean(feature?.enabled);
}

export async function requireCompanyFeature(companyId: string, featureCode: string) {
  const enabled = await checkCompanyFeature(companyId, featureCode);
  if (!enabled) {
    const meta = getEntitlementMeta(featureCode);
    throw new FeatureDisabledError(
      featureCode,
      meta ? `${meta.label} özelliği planınızda aktif değil.` : undefined
    );
  }
}

export async function checkCompanyLimit(
  companyId: string,
  limitCode: string,
  options?: { incrementBy?: number; userId?: string }
) {
  const incrementBy = options?.incrementBy ?? 1;
  const limit = await getResolvedLimit(companyId, limitCode, { userId: options?.userId });
  if (!limit) return { allowed: false, limit: null, usage: 0, remaining: 0 };

  if (limit.isUnlimited) {
    return { allowed: true, limit: null, usage: limit.usage, remaining: null };
  }

  const projected = limit.usage + incrementBy;
  const allowed = projected <= (limit.value ?? 0);
  return {
    allowed,
    limit: limit.value,
    usage: limit.usage,
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
  const check = await checkCompanyLimit(companyId, limitCode, options);
  if (!check.allowed) {
    const meta = getEntitlementMeta(limitCode);
    throw new LimitReachedError({
      limitCode,
      usage: check.usage,
      limit: check.limit,
      message: meta
        ? `${meta.label} limitine ulaşıldı (${check.usage}/${check.limit ?? "∞"}). Yeni kayıt oluşturulamaz.`
        : undefined,
    });
  }
  return check;
}

export {
  consumeCompanyUsage,
  releaseCompanyUsage,
  reserveCompanyUsage,
  finalizeCompanyUsage,
  resolveCompanyEntitlements,
};
