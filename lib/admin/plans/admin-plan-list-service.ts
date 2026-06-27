import "server-only";

import { db } from "@/lib/prisma";
import type { AdminPlanListQuery } from "@/lib/admin/plans/admin-plan-schemas";
import {
  buildAdminPlanListWhere,
  buildAdminPlanOrderBy,
} from "@/lib/admin/plans/admin-plan-filter-utils";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";
import {
  detectPlanIssues,
  ACTIVE_SUB_STATUSES,
  getPlanIssueLabel,
} from "@/lib/admin/plans/admin-plan-issue-service";
import {
  filterPlanRowsByQuery,
  paginatePlanRows,
} from "@/lib/admin/plans/admin-plan-list-utils";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import { findPriceResolutionConflicts } from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { PLAN_SUPPORTS_MULTI_CURRENCY } from "@/lib/admin/plans/admin-plan-metric-service";
import {
  formatPricingClass,
  getPlanStatusClass,
  getPlanStatusLabel,
  getPlanVisibilityLabel,
} from "@/lib/admin/plans/admin-plan-serializers";
import { getPlanMrrByPlanId } from "@/lib/admin/plans/admin-plan-metric-service";

const listSelect = {
  id: true,
  name: true,
  code: true,
  slug: true,
  shortDescription: true,
  description: true,
  planStatus: true,
  visibility: true,
  isFeatured: true,
  sortOrder: true,
  defaultCurrency: true,
  isActive: true,
  trialEnabled: true,
  trialDays: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getAdminPlanList(query: AdminPlanListQuery) {
  const where = buildAdminPlanListWhere(query);
  const orderBy = buildAdminPlanOrderBy(query);

  const plans = await db.membershipPlan.findMany({
    where,
    orderBy,
    select: listSelect,
  });

  const planIds = plans.map((p) => p.id);

  const [prices, subCounts, mrrByPlan] = await Promise.all([
    planIds.length
      ? db.membershipPlanPrice.findMany({
          where: { planId: { in: planIds }, status: { in: ["ACTIVE", "SCHEDULED"] } },
          select: {
            planId: true,
            billingInterval: true,
            currency: true,
            salePriceMinor: true,
            status: true,
            isPublic: true,
            effectiveFrom: true,
            effectiveUntil: true,
          },
        })
      : [],
    planIds.length
      ? db.companySubscription.groupBy({
          by: ["planId"],
          where: { planId: { in: planIds }, status: { in: [...ACTIVE_SUB_STATUSES] } },
          _count: { _all: true },
        })
      : [],
    getPlanMrrByPlanId(planIds),
  ]);

  const pricesByPlan = new Map<string, typeof prices>();
  for (const p of prices) {
    const list = pricesByPlan.get(p.planId) ?? [];
    list.push(p);
    pricesByPlan.set(p.planId, list);
  }

  const subCountByPlan = new Map(
    subCounts.map((g) => [g.planId, g._count._all])
  );

  const rows = plans.map((plan) => {
    const planPrices = pricesByPlan.get(plan.id) ?? [];
    const pricingClass = classifyPlanPricing(planPrices);
    const conflicts = findPriceResolutionConflicts(planPrices);
    const activeSubscriptionCount = subCountByPlan.get(plan.id) ?? 0;
    const issues = detectPlanIssues({
      planStatus: plan.planStatus,
      isActive: plan.isActive,
      defaultCurrency: plan.defaultCurrency,
      prices: planPrices,
      activeSubscriptionCount,
      supportsMultiCurrency: PLAN_SUPPORTS_MULTI_CURRENCY,
      priceConflictIntervals: conflicts,
    });
    const checkoutAvailable = isPlanCheckoutAvailable({
      planStatus: plan.planStatus,
      visibility: plan.visibility,
      code: plan.code,
      pricingClass,
      hasPriceConflicts: conflicts.length > 0,
    });

    return {
      id: plan.id,
      name: plan.name,
      code: plan.code,
      slug: plan.slug,
      shortDescription: plan.shortDescription,
      planStatus: plan.planStatus,
      planStatusLabel: getPlanStatusLabel(plan.planStatus),
      planStatusClass: getPlanStatusClass(plan.planStatus),
      visibility: plan.visibility,
      visibilityLabel: getPlanVisibilityLabel(plan.visibility),
      isFeatured: plan.isFeatured,
      sortOrder: plan.sortOrder,
      defaultCurrency: plan.defaultCurrency,
      isActiveLegacy: plan.isActive,
      pricingClass,
      pricingClassLabel: formatPricingClass(pricingClass),
      checkoutAvailable,
      activeSubscriptionCount,
      issues: issues.map((i) => ({ ...i, label: getPlanIssueLabel(i.code) })),
      mrrByCurrency: mrrByPlan.get(plan.id) ?? {},
      trialEnabled: plan.trialEnabled,
      trialDays: plan.trialDays,
      publishedAt: plan.publishedAt?.toISOString() ?? null,
      archivedAt: plan.archivedAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  });

  const filtered = filterPlanRowsByQuery(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      planStatus: r.planStatus,
      visibility: r.visibility,
      defaultCurrency: r.defaultCurrency,
      sortOrder: r.sortOrder,
      isFeatured: r.isFeatured,
      activeSubscriptionCount: r.activeSubscriptionCount,
      pricingClass: r.pricingClass,
      checkoutAvailable: r.checkoutAvailable,
      issues: r.issues,
      mrrByCurrency: r.mrrByCurrency,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
    query
  );

  const filteredIds = new Set(filtered.map((f) => f.id));
  const filteredRows = rows.filter((r) => filteredIds.has(r.id));
  const page = paginatePlanRows(filteredRows, query.page, query.pageSize);

  return {
    items: page.items,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    totalPages: page.totalPages,
  };
}
