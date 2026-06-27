import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import type { AdminPlanSubscriptionQuery } from "@/lib/admin/plans/admin-plan-schemas";
import { adminPlanSubscriptionQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { calculateMrrWithDuplicateAwareness } from "@/lib/admin/subscriptions/admin-subscription-action-validators";
import {
  detectPlanSubscriptionIssuesWithPlan,
  type PlanSubscriptionIssueCode,
} from "@/lib/admin/plans/admin-plan-subscription-issue-service";
import {
  buildMrrSubInput,
  resolveMrrMonthlyMinor,
  type MrrResolutionInput,
} from "@/lib/admin/plans/admin-plan-mrr-resolution";
import { pickTabPage, normalizeTabPage } from "@/lib/admin/plans/admin-plan-tab-query-utils";

const subInclude = {
  company: {
    select: {
      id: true,
      name: true,
      status: true,
      users: {
        where: { isOwner: true },
        take: 1,
        select: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  },
  plan: { select: { id: true, name: true, planStatus: true, defaultCurrency: true } },
  lockedPlanPrice: {
    select: {
      id: true,
      currency: true,
      status: true,
      salePriceMinor: true,
      billingInterval: true,
      monthlyEquivalentMinor: true,
    },
  },
  nextPlanPrice: {
    select: { id: true, currency: true, status: true, salePriceMinor: true, billingInterval: true },
  },
} as const;

type SubRow = Awaited<ReturnType<typeof db.companySubscription.findMany<{ include: typeof subInclude }>>>[number];

type MrrSubSlice = {
  id: string;
  companyId: string;
  status: string;
  billingInterval: MrrResolutionInput["billingInterval"];
  lockedPriceMinor: number | null;
  lockedListPriceMinor: number | null;
  lockedPlanPriceId: string | null;
  lockedPlanPrice: MrrResolutionInput["lockedPlanPrice"];
};

export function buildPlanSubscriptionWhere(
  planId: string,
  query: AdminPlanSubscriptionQuery
): Prisma.CompanySubscriptionWhereInput {
  const where: Prisma.CompanySubscriptionWhereInput = { planId };

  if (query.status !== "ALL") where.status = query.status;
  if (query.billingInterval !== "ALL") where.billingInterval = query.billingInterval;
  if (query.companyId) where.companyId = query.companyId;
  if (query.priceLockType !== "ALL") where.priceLockType = query.priceLockType;
  if (query.grandfathered === "YES") where.priceLockType = "GRANDFATHERED";
  if (query.grandfathered === "NO") where.priceLockType = { not: "GRANDFATHERED" };
  if (query.locked === "LOCKED") {
    where.OR = [{ lockedPlanPriceId: { not: null } }, { lockedPriceMinor: { not: null } }];
  } else if (query.locked === "UNLOCKED") {
    where.AND = [{ lockedPlanPriceId: null }, { lockedPriceMinor: null }];
  }
  if (query.hasNextPrice === "YES") where.nextPlanPriceId = { not: null };
  if (query.hasNextPrice === "NO") where.nextPlanPriceId = null;
  if (query.currency) where.lockedPlanPrice = { currency: query.currency };

  if (query.periodStartFrom || query.periodStartTo) {
    where.currentPeriodStart = {
      ...(query.periodStartFrom ? { gte: new Date(query.periodStartFrom) } : {}),
      ...(query.periodStartTo ? { lte: new Date(query.periodStartTo) } : {}),
    };
  }
  if (query.periodEndFrom || query.periodEndTo) {
    where.currentPeriodEnd = {
      ...(query.periodEndFrom ? { gte: new Date(query.periodEndFrom) } : {}),
      ...(query.periodEndTo ? { lte: new Date(query.periodEndTo) } : {}),
    };
  }

  if (query.q && query.q.trim().length >= 2) {
    const q = query.q.trim();
    const searchOr: Prisma.CompanySubscriptionWhereInput[] = [
      { id: { contains: q, mode: "insensitive" } },
      { companyId: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { lockedPlanPriceId: { contains: q, mode: "insensitive" } },
      { nextPlanPriceId: { contains: q, mode: "insensitive" } },
      {
        company: {
          users: {
            some: {
              isOwner: true,
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      },
    ];
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: searchOr }];
  }

  return where;
}

function buildOrderBy(query: AdminPlanSubscriptionQuery): Prisma.CompanySubscriptionOrderByWithRelationInput {
  const dir = query.sortDir;
  switch (query.sortBy) {
    case "companyName":
      return { company: { name: dir } };
    case "status":
      return { status: dir };
    case "currentPeriodEnd":
      return { currentPeriodEnd: dir };
    default:
      return { createdAt: dir };
  }
}

function matchesIssueFilter(issues: { code: PlanSubscriptionIssueCode }[], issue?: string) {
  if (!issue) return true;
  return issues.some((i) => i.code === issue);
}

type PaymentSnap = {
  subscriptionId: string | null;
  amountMinor: number | null;
  currency: string;
  billingPeriodSnapshot: string | null;
  periodMonthsSnapshot: number | null;
};

function toMrrInput(sub: MrrSubSlice, payment: PaymentSnap | null): MrrResolutionInput {
  return {
    subscriptionId: sub.id,
    status: sub.status,
    billingInterval: sub.billingInterval,
    lockedPriceMinor: sub.lockedPriceMinor,
    lockedListPriceMinor: sub.lockedListPriceMinor,
    lockedPlanPriceId: sub.lockedPlanPriceId,
    lockedPlanPrice: sub.lockedPlanPrice,
    paymentSnapshot: payment
      ? {
          subscriptionId: payment.subscriptionId ?? sub.id,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          billingPeriodSnapshot: payment.billingPeriodSnapshot,
          periodMonthsSnapshot: payment.periodMonthsSnapshot,
          monthlyEquivalentMinor: null,
        }
      : null,
    resolver: null,
  };
}

export async function getAdminPlanSubscriptionsTab(planId: string, query: AdminPlanSubscriptionQuery) {
  const plan = await db.membershipPlan.findUnique({
    where: { id: planId },
    select: { id: true, planStatus: true },
  });
  if (!plan) return null;

  const page = normalizeTabPage(query.subscriptionsPage ?? query.page);
  const orderBy = buildOrderBy(query);
  const skip = (page - 1) * query.pageSize;

  const [allForSummary, pendingChanges] = await Promise.all([
    db.companySubscription.findMany({
      where: { planId },
      select: {
        id: true,
        companyId: true,
        status: true,
        priceLockType: true,
        lockedPlanPriceId: true,
        nextPlanPriceId: true,
        lockedPriceMinor: true,
        lockedListPriceMinor: true,
        billingInterval: true,
        lockedPlanPrice: {
          select: { currency: true, monthlyEquivalentMinor: true, billingInterval: true },
        },
      },
    }),
    db.subscriptionPendingChange.findMany({
      where: { status: "PENDING", subscription: { planId } },
      select: { subscriptionId: true, targetPlanId: true },
    }),
  ]);

  const subIds = allForSummary.map((s) => s.id);
  const lastPayments =
    subIds.length > 0
      ? await db.membershipPayment.findMany({
          where: { subscriptionId: { in: subIds }, status: "PAID" },
          orderBy: { paidAt: "desc" },
          distinct: ["subscriptionId"],
          select: {
            subscriptionId: true,
            amountMinor: true,
            currency: true,
            billingPeriodSnapshot: true,
            periodMonthsSnapshot: true,
          },
        })
      : [];
  const paymentBySub = new Map(lastPayments.map((p) => [p.subscriptionId, p]));

  const pendingBySub = new Map(pendingChanges.map((p) => [p.subscriptionId, p.targetPlanId]));

  const baseWhere = buildPlanSubscriptionWhere(planId, { ...query, issue: undefined });
  const allMatching = await db.companySubscription.findMany({
    where: baseWhere,
    orderBy,
    include: subInclude,
  });

  let unresolvedSubscriptionCount = 0;
  const mrrInputs = allForSummary
    .filter((s) => ["ACTIVE", "CANCEL_AT_PERIOD_END"].includes(s.status))
    .map((s) => {
      const payment = paymentBySub.get(s.id) ?? null;
      const resolution = resolveMrrMonthlyMinor(toMrrInput(s, payment));
      if (resolution.unresolved) unresolvedSubscriptionCount++;
      return buildMrrSubInput({ ...toMrrInput(s, payment), companyId: s.companyId }, resolution);
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const mrrAnalysis = calculateMrrWithDuplicateAwareness(mrrInputs);
  const duplicateCompanyIds = new Set(mrrAnalysis.duplicateCompanies.map((d) => d.companyId));

  const mapped = allMatching.map((sub) => {
    const payment = paymentBySub.get(sub.id) ?? null;
    const mrrResolution = resolveMrrMonthlyMinor(toMrrInput(sub, payment));
    const issues = detectPlanSubscriptionIssuesWithPlan(
      { ...sub, plan: sub.plan },
      pendingBySub.get(sub.id) ?? null,
      { duplicateCompanyIds, mrrUnresolved: mrrResolution.unresolved }
    );
    const owner = sub.company.users[0]?.user ?? null;
    const monthlyRevenue = mrrResolution.monthlyMinor != null ? mrrResolution.monthlyMinor / 100 : null;

    return {
      subscriptionId: sub.id,
      subscriptionShortId: sub.id.slice(0, 8),
      status: sub.status,
      startedAt: sub.currentPeriodStart?.toISOString() ?? sub.createdAt.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      company: {
        id: sub.company.id,
        shortId: sub.company.id.slice(0, 8),
        name: sub.company.name,
        status: sub.company.status,
        href: `/admin/companies/${sub.company.id}`,
      },
      owner,
      billingInterval: sub.billingInterval,
      priceSnapshot: mrrResolution.label,
      priceSource: mrrResolution.source,
      lockedPlanPriceId: sub.lockedPlanPriceId,
      lockedPriceMinor: sub.lockedPriceMinor,
      currency: mrrResolution.currency,
      nextPlanPriceId: sub.nextPlanPriceId,
      nextPriceEffectiveAt: sub.nextPriceEffectiveAt?.toISOString() ?? null,
      priceLockType: sub.priceLockType,
      isGrandfathered: sub.priceLockType === "GRANDFATHERED",
      hasNextRenewalChange: Boolean(sub.nextPlanPriceId),
      monthlyRevenue,
      mrrCurrency: mrrResolution.currency,
      mrrUnresolved: mrrResolution.unresolved,
      issues,
      links: {
        subscription: `/admin/subscriptions/${sub.id}`,
        company: `/admin/companies/${sub.company.id}`,
        payments: `/admin/payments?subscriptionId=${sub.id}`,
      },
    };
  });

  const filtered = query.issue ? mapped.filter((row) => matchesIssueFilter(row.issues, query.issue)) : mapped;
  const total = filtered.length;
  const pageItems = filtered.slice(skip, skip + query.pageSize);

  const mrrMajor: Record<string, number> = {};
  for (const [cur, v] of Object.entries(mrrAnalysis.mrrMinor)) {
    mrrMajor[cur] = v / 100;
  }
  const excessMrrMajor: Record<string, number> = {};
  for (const dup of mrrAnalysis.duplicateCompanies) {
    for (const [cur, v] of Object.entries(dup.excessMrrMinor)) {
      excessMrrMajor[cur] = (excessMrrMajor[cur] ?? 0) + v / 100;
    }
  }

  const summary = {
    total: allForSummary.length,
    active: allForSummary.filter((s) => s.status === "ACTIVE").length,
    trial: allForSummary.filter((s) => s.status === "TRIAL").length,
    pastDue: allForSummary.filter((s) => s.status === "PAST_DUE").length,
    cancelAtPeriodEnd: allForSummary.filter((s) => s.status === "CANCEL_AT_PERIOD_END").length,
    cancelled: allForSummary.filter((s) => s.status === "CANCELLED").length,
    expired: allForSummary.filter((s) => s.status === "EXPIRED").length,
    grandfathered: allForSummary.filter((s) => s.priceLockType === "GRANDFATHERED").length,
    withPriceLock: allForSummary.filter((s) => s.lockedPlanPriceId || s.lockedPriceMinor != null).length,
    withNextPrice: allForSummary.filter((s) => s.nextPlanPriceId).length,
    withoutPriceLock: allForSummary.filter((s) => !s.lockedPlanPriceId && s.lockedPriceMinor == null).length,
    mrrByCurrency: mrrMajor,
    excessMrrByCurrency: excessMrrMajor,
    duplicateActiveCompanyCount: mrrAnalysis.duplicateCompanies.length,
    unresolvedSubscriptionCount,
    unresolvedMrrCount: unresolvedSubscriptionCount,
  };

  return {
    summary,
    total,
    page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    items: pageItems,
  };
}

export function parsePlanSubscriptionQuery(
  searchParams: URLSearchParams,
  raw?: Record<string, string | string[] | undefined>
): AdminPlanSubscriptionQuery {
  const parsed = adminPlanSubscriptionQuerySchema.parse(Object.fromEntries(searchParams.entries()));
  if (raw) {
    return { ...parsed, page: pickTabPage(raw, "subscriptions"), subscriptionsPage: pickTabPage(raw, "subscriptions") };
  }
  return parsed;
}
