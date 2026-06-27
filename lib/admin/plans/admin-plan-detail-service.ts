import "server-only";

import type { MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import { PLAN_SUPPORTS_MULTI_CURRENCY } from "@/lib/admin/plans/admin-plan-metric-service";
import { ACTIVE_SUB_STATUSES } from "@/lib/admin/plans/admin-plan-issue-service";
import {
  detectPlanDetailIssues,
  getPlanDetailIssueLabel,
} from "@/lib/admin/plans/admin-plan-detail-issue-service";
import {
  findEffectivePricesAt,
  findPriceResolutionConflicts,
} from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { calculateMrrWithDuplicateAwareness } from "@/lib/admin/subscriptions/admin-subscription-action-validators";
import {
  formatPricingClass,
  getPlanStatusClass,
  getPlanStatusLabel,
  getPlanVisibilityLabel,
} from "@/lib/admin/plans/admin-plan-serializers";
import { serializePlanPriceForAdmin } from "@/lib/membership-plan-price-service";
import type { AdminPlanTab } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanFeaturesTabData } from "@/lib/admin/plans/admin-plan-feature-service";
import { getAdminPlanEntitlementsView } from "@/lib/admin/entitlements/admin-plan-entitlement-admin-service";
import { getAdminPlanSubscriptionsTab } from "@/lib/admin/plans/admin-plan-subscription-service";
import { getAdminPlanHistoryTab } from "@/lib/admin/plans/admin-plan-history-service";
import { getAdminPlanActivityTab } from "@/lib/admin/plans/admin-plan-activity-service";
import { listAdminPlanNotes } from "@/lib/admin/plans/admin-plan-note-service";
import {
  adminPlanSubscriptionQuerySchema,
  adminPlanHistoryQuerySchema,
  adminPlanActivityQuerySchema,
} from "@/lib/admin/plans/admin-plan-schemas";
import { pickTabPage } from "@/lib/admin/plans/admin-plan-tab-query-utils";

const INTERVALS: MembershipPeriod[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"];

const INTERVAL_LABELS: Record<MembershipPeriod, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

export async function getAdminPlanDetail(
  planId: string,
  tab: AdminPlanTab = "overview",
  rawParams?: Record<string, string | string[] | undefined>
) {
  const plan = await db.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) return null;

  const now = new Date();
  const defaultCurrency = plan.defaultCurrency || plan.currency;

  const [prices, subs, pendingChangeCount] = await Promise.all([
    db.membershipPlanPrice.findMany({
      where: { planId },
      orderBy: [{ billingInterval: "asc" }, { version: "desc" }],
    }),
    db.companySubscription.findMany({
      where: { planId, status: { in: [...ACTIVE_SUB_STATUSES] } },
      select: {
        id: true,
        companyId: true,
        status: true,
        lockedPlanPriceId: true,
        lockedPriceMinor: true,
        priceLockType: true,
        nextPlanPriceId: true,
        billingInterval: true,
        lockedPlanPrice: {
          select: { currency: true, monthlyEquivalentMinor: true },
        },
      },
    }),
    db.subscriptionPendingChange.count({
      where: { status: "PENDING", targetPlanId: planId },
    }),
  ]);

  const activeCount = subs.filter((s) => s.status === "ACTIVE").length;
  const trialCount = subs.filter((s) => s.status === "TRIAL").length;
  const cancelAtEndCount = subs.filter((s) => s.status === "CANCEL_AT_PERIOD_END").length;

  const mrrSubs = subs.filter(
    (s) => s.status === "ACTIVE" || s.status === "CANCEL_AT_PERIOD_END"
  );
  const mrrAnalysis = calculateMrrWithDuplicateAwareness(
    mrrSubs.map((s) => ({
      companyId: s.companyId,
      subscriptionId: s.id,
      lockedPlanPrice: s.lockedPlanPrice,
    }))
  );
  const mrrMajor: Record<string, number> = {};
  for (const [cur, v] of Object.entries(mrrAnalysis.mrrMinor)) {
    mrrMajor[cur] = v / 100;
  }

  const purchasablePrices = prices.map((p) => ({
    id: p.id,
    billingInterval: p.billingInterval,
    currency: p.currency,
    salePriceMinor: p.salePriceMinor,
    listPriceMinor: p.listPriceMinor,
    status: p.status,
    isPublic: p.isPublic,
    effectiveFrom: p.effectiveFrom,
    effectiveUntil: p.effectiveUntil,
  }));

  const pricingClass = classifyPlanPricing(purchasablePrices, now);
  const conflicts = findPriceResolutionConflicts(purchasablePrices, now);

  const issues = detectPlanDetailIssues({
    planStatus: plan.planStatus,
    isActive: plan.isActive,
    defaultCurrency,
    legacyPrices: {
      monthly: Number(plan.monthlyPrice),
      quarterly: Number(plan.quarterlyPrice),
      semiAnnual: Number(plan.semiAnnualPrice),
      yearly: Number(plan.yearlyPrice),
    },
    prices: purchasablePrices,
    subscriptionStats: {
      active: activeCount,
      trial: trialCount,
      cancelAtPeriodEnd: cancelAtEndCount,
      duplicateActiveCompanies: mrrAnalysis.duplicateCompanies.length,
    },
    pendingChangeTargetCount: pendingChangeCount,
    supportsMultiCurrency: PLAN_SUPPORTS_MULTI_CURRENCY,
    now,
  }).map((i) => ({ ...i, label: getPlanDetailIssueLabel(i.code) }));

  const checkoutAvailable = isPlanCheckoutAvailable({
    planStatus: plan.planStatus,
    visibility: plan.visibility,
    code: plan.code,
    pricingClass,
    hasPriceConflicts: conflicts.length > 0,
  });

  const header = {
    id: plan.id,
    shortId: plan.id.slice(0, 10),
    name: plan.name,
    code: plan.code,
    planStatus: plan.planStatus,
    planStatusLabel: getPlanStatusLabel(plan.planStatus),
    planStatusClass: getPlanStatusClass(plan.planStatus),
    visibility: plan.visibility,
    visibilityLabel: getPlanVisibilityLabel(plan.visibility),
    isActiveLegacy: plan.isActive,
    pricingClass,
    pricingClassLabel: formatPricingClass(pricingClass),
    activeSubscriptionCount: activeCount,
    trialSubscriptionCount: trialCount,
    cancelAtPeriodEndCount: cancelAtEndCount,
    mrrByCurrency: mrrMajor,
    openIssueCount: issues.filter((i) => i.severity !== "info").length,
    issueCount: issues.length,
    checkoutAvailable,
    updatedAt: plan.updatedAt.toISOString(),
  };

  let tabData: unknown = null;

  if (tab === "overview") {
    tabData = buildOverviewTab({
      plan,
      defaultCurrency,
      prices,
      purchasablePrices,
      subs,
      mrrMajor,
      issues,
      now,
    });
  } else if (tab === "pricing") {
    tabData = await buildPricingTab(planId, prices, subs, now);
  } else if (tab === "features") {
    tabData = await getAdminPlanFeaturesTabData(planId);
  } else if (tab === "entitlements") {
    tabData = await getAdminPlanEntitlementsView(planId);
  } else if (tab === "subscriptions") {
    const params = Object.fromEntries(
      Object.entries(rawParams ?? {}).filter(([, v]) => typeof v === "string") as [string, string][]
    );
    const page = pickTabPage(rawParams ?? {}, "subscriptions");
    const query = adminPlanSubscriptionQuerySchema.parse({ ...params, page, subscriptionsPage: page });
    tabData = await getAdminPlanSubscriptionsTab(planId, query);
  } else if (tab === "history") {
    const params = Object.fromEntries(
      Object.entries(rawParams ?? {}).filter(([, v]) => typeof v === "string") as [string, string][]
    );
    const page = pickTabPage(rawParams ?? {}, "history");
    const query = adminPlanHistoryQuerySchema.parse({ ...params, page, historyPage: page });
    tabData = await getAdminPlanHistoryTab(planId, query);
  } else if (tab === "activity") {
    const params = Object.fromEntries(
      Object.entries(rawParams ?? {}).filter(([, v]) => typeof v === "string") as [string, string][]
    );
    const page = pickTabPage(rawParams ?? {}, "activity");
    const query = adminPlanActivityQuerySchema.parse({ ...params, page, activityPage: page });
    tabData = await getAdminPlanActivityTab(planId, query);
  } else if (tab === "notes") {
    tabData = { notes: await listAdminPlanNotes(planId) };
  }

  return { header, tab, tabData, plan: serializePlanBasics(plan) };
}

function serializePlanBasics(plan: {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  planStatus: import("@prisma/client").PlanStatus;
  visibility: import("@prisma/client").PlanVisibility;
  sortOrder: number;
  trialEnabled: boolean;
  trialDays: number;
  defaultCurrency: string;
  vatRate: number;
  vatIncluded: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    slug: plan.slug,
    description: plan.description,
    shortDescription: plan.shortDescription,
    planStatus: plan.planStatus,
    visibility: plan.visibility,
    sortOrder: plan.sortOrder,
    trialEnabled: plan.trialEnabled,
    trialDays: plan.trialDays,
    defaultCurrency: plan.defaultCurrency,
    vatRate: plan.vatRate,
    vatIncluded: plan.vatIncluded,
    publishedAt: plan.publishedAt?.toISOString() ?? null,
    archivedAt: plan.archivedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

function buildOverviewTab(input: {
  plan: Awaited<ReturnType<typeof db.membershipPlan.findUnique>> & object;
  defaultCurrency: string;
  prices: Awaited<ReturnType<typeof db.membershipPlanPrice.findMany>>;
  purchasablePrices: Array<{
    id: string;
    billingInterval: MembershipPeriod;
    currency: string;
    salePriceMinor: number;
    listPriceMinor: number;
    status: import("@prisma/client").PlanPriceStatus;
    isPublic: boolean;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  }>;
  subs: Array<{
    lockedPlanPriceId: string | null;
    lockedPriceMinor: number | null;
    priceLockType: import("@prisma/client").SubscriptionPriceChangePolicy | null;
    nextPlanPriceId: string | null;
    status: import("@prisma/client").SubscriptionStatus;
  }>;
  mrrMajor: Record<string, number>;
  issues: Array<{ code: string; severity: string; message: string; label: string; tab?: string }>;
  now: Date;
}) {
  const { plan, defaultCurrency, prices, purchasablePrices, subs, mrrMajor, issues, now } =
    input;

  const intervalSummaries = INTERVALS.map((interval) => {
    const effective = findEffectivePricesAt(
      purchasablePrices,
      interval,
      defaultCurrency,
      now
    );
    const conflict = effective.length > 1;
    const price = effective[0] ?? null;
    const full = price ? prices.find((p) => p.id === price.id) : null;

    return {
      interval,
      intervalLabel: INTERVAL_LABELS[interval],
      conflict,
      purchasable: Boolean(
        price?.isPublic &&
          ["ACTIVE", "SCHEDULED"].includes(price.status) &&
          price.salePriceMinor >= 0
      ),
      effective: full
        ? {
            ...serializePlanPriceForAdmin(full),
            resolutionConflict: conflict,
          }
        : null,
    };
  });

  const lockedCount = subs.filter((s) => s.lockedPlanPriceId).length;
  const nextPriceCount = subs.filter((s) => s.nextPlanPriceId).length;
  const noLockCount = subs.filter(
    (s) => !s.lockedPlanPriceId && s.status !== "TRIAL"
  ).length;
  const grandfatheredCount = subs.filter((s) => s.priceLockType === "GRANDFATHERED").length;

  return {
    basics: serializePlanBasics(plan),
    legacyPrices: {
      monthly: Number(plan.monthlyPrice),
      quarterly: Number(plan.quarterlyPrice),
      semiAnnual: Number(plan.semiAnnualPrice),
      yearly: Number(plan.yearlyPrice),
      currency: defaultCurrency,
      readOnly: true,
    },
    intervalSummaries,
    subscriptionImpact: {
      active: subs.filter((s) => s.status === "ACTIVE").length,
      trial: subs.filter((s) => s.status === "TRIAL").length,
      cancelAtPeriodEnd: subs.filter((s) => s.status === "CANCEL_AT_PERIOD_END").length,
      withLockedPrice: lockedCount,
      withNextPrice: nextPriceCount,
      withoutPriceLock: noLockCount,
      grandfathered: grandfatheredCount,
      mrrByCurrency: mrrMajor,
    },
    issues,
  };
}

async function buildPricingTab(
  planId: string,
  prices: Awaited<ReturnType<typeof db.membershipPlanPrice.findMany>>,
  subs: Array<{ lockedPlanPriceId: string | null; nextPlanPriceId: string | null }>,
  now: Date
) {
  const rows = prices.map((p) => {
    const lockedUsage = subs.filter((s) => s.lockedPlanPriceId === p.id).length;
    const nextUsage = subs.filter((s) => s.nextPlanPriceId === p.id).length;
    const serialized = serializePlanPriceForAdmin(p);

    let lifecycleLabel = "Bilinmiyor";
    if (p.status === "DRAFT" || p.status === "ARCHIVED") {
      lifecycleLabel = p.status === "DRAFT" ? "Taslak" : "Arşiv";
    } else if (p.effectiveFrom > now) {
      lifecycleLabel = "Henüz başlamadı";
    } else if (p.effectiveUntil && p.effectiveUntil <= now) {
      lifecycleLabel = "Süresi doldu";
    } else if (p.status === "ACTIVE" || (p.status === "SCHEDULED" && p.effectiveFrom <= now)) {
      lifecycleLabel = "Şu an efektif";
    } else if (p.status === "EXPIRED") {
      lifecycleLabel = "Süresi doldu";
    }

    return {
      ...serialized,
      lockedSubscriptionCount: lockedUsage,
      nextRenewalSubscriptionCount: nextUsage,
      lifecycleLabel,
      group:
        p.status === "DRAFT" || p.status === "ARCHIVED"
          ? "draft"
          : p.effectiveFrom > now
            ? "scheduled"
            : p.status === "EXPIRED" || (p.effectiveUntil && p.effectiveUntil <= now)
              ? "historical"
              : "effective",
    };
  });

  return {
    groups: {
      effective: rows.filter((r) => r.group === "effective"),
      scheduled: rows.filter((r) => r.group === "scheduled"),
      historical: rows.filter((r) => r.group === "historical"),
      draft: rows.filter((r) => r.group === "draft"),
    },
    all: rows,
  };
}

export async function getAdminPlanHeader(planId: string) {
  const detail = await getAdminPlanDetail(planId, "overview");
  if (!detail) return null;
  return detail.header;
}
