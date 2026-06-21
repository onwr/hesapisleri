import "server-only";

import type { PlanEntitlement } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  ENTITLEMENT_REGISTRY,
  getEntitlementMeta,
} from "@/lib/billing/entitlements/entitlement-registry";
import {
  getCachedEntitlements,
  setCachedEntitlements,
} from "@/lib/billing/entitlements/entitlement-cache";
import type {
  CompanyEntitlementsResult,
  EntitlementContribution,
  EntitlementSource,
  ResolvedBooleanEntitlement,
  ResolvedEntitlement,
  ResolvedLimitEntitlement,
} from "@/lib/billing/entitlements/entitlement-types";
import {
  getCompanyUsageSummary,
  getUsageForLimitCode,
} from "@/lib/billing/usage/usage-query-service";

type PlanEntRow = Pick<
  PlanEntitlement,
  | "code"
  | "valueType"
  | "booleanValue"
  | "numberValue"
  | "stringValue"
  | "isUnlimited"
>;

function contributionFromPlan(row: PlanEntRow): EntitlementContribution {
  return {
    source: "PLAN",
    valueType: row.valueType,
    booleanValue: row.booleanValue,
    numberValue: row.numberValue,
    stringValue: row.stringValue,
    isUnlimited: row.isUnlimited,
    label: "Plan",
  };
}

function mergeBoolean(contributions: EntitlementContribution[]): {
  enabled: boolean;
  source: EntitlementSource;
} {
  const order: EntitlementSource[] = ["OVERRIDE", "ADDON", "TRIAL", "PLAN"];
  for (const src of order) {
    const match = contributions.find((c) => c.source === src);
    if (match?.booleanValue != null) {
      return { enabled: match.booleanValue, source: src };
    }
  }
  const any = contributions.find((c) => c.booleanValue != null);
  return { enabled: any?.booleanValue ?? false, source: any?.source ?? "PLAN" };
}

function mergeLimit(contributions: EntitlementContribution[]): {
  value: number | null;
  isUnlimited: boolean;
  source: EntitlementSource;
  breakdown: { plan: number; addon: number; override: number; usagePack: number };
} {
  const breakdown = { plan: 0, addon: 0, override: 0, usagePack: 0 };

  if (contributions.some((c) => c.isUnlimited)) {
    const src =
      contributions.find((c) => c.isUnlimited && c.source === "OVERRIDE")?.source ??
      contributions.find((c) => c.isUnlimited)?.source ??
      "PLAN";
    return { value: null, isUnlimited: true, source: src, breakdown };
  }

  for (const c of contributions) {
    const qty = c.numberValue ?? 0;
    if (c.source === "PLAN") breakdown.plan += qty;
    else if (c.source === "ADDON") breakdown.addon += qty;
    else if (c.source === "OVERRIDE") breakdown.override += qty;
    else if (c.source === "USAGE_PACK") breakdown.usagePack += qty;
  }

  const total = breakdown.plan + breakdown.addon + breakdown.override + breakdown.usagePack;
  let source: EntitlementSource = "PLAN";
  if (breakdown.override > 0) source = "OVERRIDE";
  else if (breakdown.addon > 0) source = "ADDON";
  else if (breakdown.usagePack > 0) source = "USAGE_PACK";

  return { value: total, isUnlimited: false, source, breakdown };
}

async function loadResolutionContext(companyId: string) {
  const now = new Date();

  const [subscription, overrides, addOnSubs, usageCredits] = await Promise.all([
    db.companySubscription.findUnique({
      where: { companyId },
      include: {
        plan: {
          include: { entitlements: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    db.companyEntitlementOverride.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    }),
    db.companyAddOnSubscription.findMany({
      where: {
        companyId,
        status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] },
      },
      include: { addOn: true },
    }),
    db.companyUsageCredit.groupBy({
      by: ["entitlementCode"],
      where: {
        companyId,
        status: "ACTIVE",
        remaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      _sum: { remaining: true },
    }),
  ]);

  const planEntitlements = subscription?.plan?.entitlements ?? [];
  const isTrial = subscription?.status === "TRIAL";

  const versionKey = [
    subscription?.updatedAt?.toISOString() ?? "none",
    overrides.length,
    addOnSubs.map((s) => `${s.id}:${s.quantity}:${s.updatedAt.toISOString()}`).join(","),
    usageCredits.map((c) => `${c.entitlementCode}:${c._sum.remaining}`).join(","),
  ].join("|");

  return {
    subscription,
    planEntitlements,
    isTrial,
    overrides,
    addOnSubs,
    usageCredits,
    versionKey,
    now,
  };
}

export async function resolveCompanyEntitlements(
  companyId: string,
  options?: { skipCache?: boolean; userId?: string }
): Promise<CompanyEntitlementsResult> {
  const ctx = await loadResolutionContext(companyId);

  if (!options?.skipCache) {
    const cached = getCachedEntitlements(companyId, ctx.versionKey);
    if (cached) return cached;
  }

  const contributionsByCode = new Map<string, EntitlementContribution[]>();

  for (const row of ctx.planEntitlements) {
    const list = contributionsByCode.get(row.code) ?? [];
    list.push(contributionFromPlan(row));
    contributionsByCode.set(row.code, list);
  }

  if (ctx.isTrial) {
    for (const code of Object.keys(ENTITLEMENT_REGISTRY)) {
      const meta = ENTITLEMENT_REGISTRY[code];
      const list = contributionsByCode.get(code) ?? [];
      if (meta.kind === "FEATURE") {
        list.push({ source: "TRIAL", valueType: "BOOLEAN", booleanValue: true, label: "Deneme" });
      } else if (meta.defaultBehavior !== "ZERO") {
        list.push({
          source: "TRIAL",
          valueType: "NUMBER",
          numberValue: meta.metered ? 50 : 10,
          label: "Deneme",
        });
      }
      contributionsByCode.set(code, list);
    }
  }

  for (const sub of ctx.addOnSubs) {
    const code = sub.addOn.entitlementCode;
    const meta = getEntitlementMeta(code);
    const list = contributionsByCode.get(code) ?? [];
    const qty = sub.addOn.entitlementQuantity * sub.quantity;

    if (meta?.kind === "FEATURE") {
      list.push({
        source: "ADDON",
        sourceId: sub.id,
        valueType: "BOOLEAN",
        booleanValue: true,
        label: sub.addOn.name,
      });
    } else {
      list.push({
        source: "ADDON",
        sourceId: sub.id,
        valueType: "NUMBER",
        numberValue: qty,
        label: sub.addOn.name,
      });
    }
    contributionsByCode.set(code, list);
  }

  for (const row of ctx.overrides) {
    const list = contributionsByCode.get(row.entitlementCode) ?? [];
    list.push({
      source: "OVERRIDE",
      sourceId: row.id,
      valueType: row.valueType,
      booleanValue: row.booleanValue,
      numberValue: row.numberValue,
      stringValue: row.stringValue,
      isUnlimited: row.isUnlimited,
      label: "Özel Hak",
    });
    contributionsByCode.set(row.entitlementCode, list);
  }

  for (const credit of ctx.usageCredits) {
    const remaining = credit._sum.remaining ?? 0;
    if (remaining <= 0) continue;
    const list = contributionsByCode.get(credit.entitlementCode) ?? [];
    list.push({
      source: "USAGE_PACK",
      valueType: "NUMBER",
      numberValue: remaining,
      label: "Kullanım Paketi",
    });
    contributionsByCode.set(credit.entitlementCode, list);
  }

  const usageSummary = await getCompanyUsageSummary(companyId, { userId: options?.userId });
  const entitlements: Record<string, ResolvedEntitlement> = {};

  for (const [code, meta] of Object.entries(ENTITLEMENT_REGISTRY)) {
    const contributions = contributionsByCode.get(code) ?? [];

    if (meta.kind === "FEATURE") {
      const merged = mergeBoolean(contributions);
      const resolved: ResolvedBooleanEntitlement = {
        code,
        kind: "FEATURE",
        enabled: merged.enabled,
        source: merged.source,
        sources: contributions,
      };
      entitlements[code] = resolved;
      continue;
    }

    const merged = mergeLimit(contributions);
    const usage = getUsageForLimitCode(usageSummary, code);
    const limit = merged.isUnlimited ? null : merged.value;
    const remaining = merged.isUnlimited ? null : Math.max(0, (limit ?? 0) - usage);
    const overBy = merged.isUnlimited ? 0 : Math.max(0, usage - (limit ?? 0));
    const isOverLimit = !merged.isUnlimited && overBy > 0;
    const canCreate = merged.isUnlimited || (limit != null && usage < limit);

    const resolved: ResolvedLimitEntitlement = {
      code,
      kind: "LIMIT",
      value: limit,
      isUnlimited: merged.isUnlimited,
      usage,
      reserved: 0,
      remaining,
      overBy,
      isOverLimit,
      canCreate,
      source: merged.source,
      sources: contributions,
      resetsAt:
        meta.resetPeriod === "MONTHLY"
          ? new Date(ctx.now.getFullYear(), ctx.now.getMonth() + 1, 1).toISOString()
          : null,
      breakdown: merged.breakdown,
    };
    entitlements[code] = resolved;
  }

  const result: CompanyEntitlementsResult = {
    companyId,
    resolvedAt: ctx.now.toISOString(),
    entitlements,
  };

  setCachedEntitlements(companyId, ctx.versionKey, result);
  return result;
}

export async function getResolvedLimit(
  companyId: string,
  code: string,
  options?: { userId?: string }
) {
  const resolved = await resolveCompanyEntitlements(companyId, options);
  const entry = resolved.entitlements[code];
  if (!entry || entry.kind !== "LIMIT") return null;
  return entry;
}

export async function getResolvedFeature(companyId: string, code: string) {
  const resolved = await resolveCompanyEntitlements(companyId);
  const entry = resolved.entitlements[code];
  if (!entry || entry.kind !== "FEATURE") return null;
  return entry;
}

export async function previewEntitlementChange(input: {
  companyId: string;
  planEntitlements?: PlanEntRow[];
  addOnQuantities?: Record<string, number>;
}) {
  const current = await resolveCompanyEntitlements(input.companyId, { skipCache: true });
  return { current, proposed: current };
}
