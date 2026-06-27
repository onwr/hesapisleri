import "server-only";
import { db } from "@/lib/prisma";
import { resolveCompanyEntitlements } from "@/lib/billing/entitlements/entitlement-resolution-service";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";

export async function getSubscriptionEntitlementsTab(
  subscriptionId: string,
  companyId: string
) {
  // Plan entitlements from schema
  const sub = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: {
        include: {
          entitlements: {
            select: { code: true, booleanValue: true, numberValue: true },
          },
        },
      },
    },
  });

  if (!sub) return null;

  // Resolve actual entitlements for this company
  let resolved: Record<string, unknown> = {};
  try {
    const result = await resolveCompanyEntitlements(companyId, { skipCache: true });
    resolved = result as unknown as Record<string, unknown>;
  } catch {
    // entitlement resolution may fail without active subscription — continue with plan data
  }

  // Add-on entitlements
  const addOnSubs = await db.companyAddOnSubscription.findMany({
    where: { subscriptionId, status: { in: ["ACTIVE", "PENDING"] } },
    include: {
      addOn: { select: { entitlementCode: true, entitlementQuantity: true, name: true } },
    },
  });

  // Overrides
  let overrides: Array<{ code: string; value: unknown }> = [];
  try {
    const entitlementOverrides = await db.companyEntitlementOverride.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { entitlementCode: true, booleanValue: true, numberValue: true },
    });
    overrides = entitlementOverrides.map((o) => ({
      code: o.entitlementCode,
      value: o.booleanValue ?? o.numberValue,
    }));
  } catch {
    // EntitlementOverride table may not exist in all environments
  }

  const planEntitlements = (sub.plan?.entitlements ?? []).map((e) => {
    const meta = getEntitlementMeta(e.code);
    const resolvedValue = (resolved as Record<string, unknown>)[e.code];
    const override = overrides.find((o) => o.code === e.code);
    const addOnBonus = addOnSubs
      .filter((a) => a.addOn.entitlementCode === e.code)
      .reduce((sum, a) => sum + a.addOn.entitlementQuantity * a.quantity, 0);

    return {
      code: e.code,
      label: meta?.label ?? e.code,
      type: meta?.valueType ?? "BOOLEAN",
      planValue: e.booleanValue ?? e.numberValue,
      addOnBonus: addOnBonus > 0 ? addOnBonus : null,
      overrideValue: override?.value ?? null,
      resolvedValue: resolvedValue ?? null,
      source: override
        ? "OVERRIDE"
        : addOnBonus > 0
          ? "ADDON"
          : "PLAN",
    };
  });

  return {
    subscriptionId,
    companyId,
    planEntitlements,
    overrideCount: overrides.length,
    addOnCount: addOnSubs.length,
    analyticsOnly: true, // operasyonel enforcement devre dışı
    disclaimer:
      "Plan hakları ve limitleri analitik amaçla gösterilir; operasyonel işlemleri engellemez.",
  };
}
