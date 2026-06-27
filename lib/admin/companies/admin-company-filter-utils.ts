import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { startOfMonth, endOfMonth } from "@/lib/dashboard-metrics";
import { parseDateParam, normalizeDateRange } from "@/lib/sales-page-utils";
import {
  ADMIN_COMPANY_PAGE_SIZES,
  adminCompanyListSortSchema,
} from "@/lib/admin/companies/admin-company-schemas";

export type AdminCompanyListFilters = {
  q?: string;
  status?: string;
  subscription?: string;
  planId?: string;
  payment?: string;
  activity?: string;
  created?: string;
  createdFrom?: string;
  createdTo?: string;
  issue?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export function parseAdminCompanyFilters(
  params: Record<string, string | string[] | undefined>
): AdminCompanyListFilters {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, Number(pick("page") ?? 1) || 1);
  const rawPageSize = Number(pick("pageSize") ?? 25) || 25;
  const pageSize = ADMIN_COMPANY_PAGE_SIZES.includes(
    rawPageSize as (typeof ADMIN_COMPANY_PAGE_SIZES)[number]
  )
    ? rawPageSize
    : 25;

  const sortParsed = adminCompanyListSortSchema.safeParse(pick("sort"));
  const sort = sortParsed.success ? sortParsed.data : "newest";

  return {
    q: pick("q")?.trim() || undefined,
    status: pick("status") || undefined,
    subscription: pick("subscription") || undefined,
    planId: pick("planId") || undefined,
    payment: pick("payment") || undefined,
    activity: pick("activity") || undefined,
    created: pick("created") || undefined,
    createdFrom: pick("createdFrom") || undefined,
    createdTo: pick("createdTo") || undefined,
    issue: pick("issue") || undefined,
    sort,
    page,
    pageSize,
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveCreatedRange(filters: AdminCompanyListFilters, now = new Date()) {
  if (filters.createdFrom && filters.createdTo) {
    const from = parseDateParam(filters.createdFrom) ?? startOfDay(now);
    const to = parseDateParam(filters.createdTo) ?? endOfDay(now);
    return normalizeDateRange(from, to);
  }

  if (filters.created === "today") {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (filters.created === "7d") {
    return { from: startOfDay(shiftDays(now, -6)), to: endOfDay(now) };
  }
  if (filters.created === "30d") {
    return { from: startOfDay(shiftDays(now, -29)), to: endOfDay(now) };
  }

  return null;
}

export function buildAdminCompanyListWhere(
  filters: AdminCompanyListFilters,
  now = new Date()
): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};

  if (filters.q && filters.q.length >= 2) {
    const q = filters.q;
    where.OR = [
      { id: q },
      { name: { contains: q, mode: "insensitive" } },
      { taxNo: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { referralCode: { contains: q, mode: "insensitive" } },
      {
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
      {
        subscription: {
          OR: [{ id: q }],
        },
      },
      {
        membershipPayments: {
          some: {
            OR: [
              { id: q },
              { merchantOid: { contains: q, mode: "insensitive" } },
              { providerPaymentId: { contains: q, mode: "insensitive" } },
            ],
          },
        },
      },
    ];
  }

  if (filters.status && filters.status !== "ALL") {
    if (filters.status === "ARCHIVED") {
      where.archivedAt = { not: null };
    } else {
      where.status = filters.status as Prisma.EnumStatusFilter["equals"];
      if (filters.status !== "PASSIVE") {
        where.archivedAt = null;
      }
    }
  }

  if (filters.subscription && filters.subscription !== "ALL") {
    if (filters.subscription === "NONE") {
      where.subscription = { is: null };
    } else {
      where.subscription = {
        is: {
          status: filters.subscription as SubscriptionStatus,
        },
      };
    }
  }

  if (filters.planId && filters.planId !== "ALL") {
    where.subscription = {
      is: { planId: filters.planId },
    };
  }

  if (filters.payment && filters.payment !== "ALL") {
    if (filters.payment === "none") {
      where.membershipPayments = { none: { provider: { not: "TRIAL" } } };
    } else if (filters.payment === "paid") {
      where.membershipPayments = {
        some: { status: "PAID", provider: { not: "TRIAL" } },
      };
    } else if (filters.payment === "pending") {
      where.membershipPayments = {
        some: {
          status: { in: ["PENDING", "WAIT_CALLBACK", "FORM_READY"] },
          provider: { not: "TRIAL" },
        },
      };
    } else if (filters.payment === "failed") {
      where.membershipPayments = {
        some: { status: "FAILED", provider: { not: "TRIAL" } },
      };
    } else if (filters.payment === "refunded") {
      where.membershipPayments = {
        some: {
          status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
          provider: { not: "TRIAL" },
        },
      };
    }
  }

  const activitySince = (days: number) =>
    startOfDay(shiftDays(now, -days));

  if (filters.activity === "24h") {
    where.activityLogs = {
      some: { createdAt: { gte: shiftDays(now, -1) } },
    };
  } else if (filters.activity === "7d") {
    where.activityLogs = {
      some: { createdAt: { gte: activitySince(7) } },
    };
  } else if (filters.activity === "30d") {
    where.activityLogs = {
      some: { createdAt: { gte: activitySince(30) } },
    };
  } else if (filters.activity === "inactive_30d") {
    where.activityLogs = {
      none: { createdAt: { gte: activitySince(30) } },
    };
  } else if (filters.activity === "never") {
    where.activityLogs = { none: {} };
  }

  const createdRange = resolveCreatedRange(filters, now);
  if (createdRange) {
    where.createdAt = { gte: createdRange.from, lte: createdRange.to };
  }

  if (filters.issue && filters.issue !== "ALL") {
    applyIssueFilter(where, filters.issue, now);
  }

  return where;
}

function applyIssueFilter(
  where: Prisma.CompanyWhereInput,
  issue: string,
  now: Date
) {
  const sevenDaysAhead = shiftDays(now, 7);
  const fourteenDaysAgo = shiftDays(now, -14);
  const thirtyDaysAgo = shiftDays(now, -30);

  switch (issue) {
    case "trial_ending":
      where.subscription = {
        is: {
          status: "TRIAL",
          trialEndsAt: { lte: sevenDaysAhead },
        },
      };
      break;
    case "payment_overdue":
      where.subscription = {
        is: { status: { in: ["PAST_DUE", "GRACE_PERIOD"] } },
      };
      break;
    case "payment_failed":
      where.membershipPayments = {
        some: { status: "FAILED", provider: { not: "TRIAL" } },
      };
      break;
    case "multiple_failed_payments":
      where.subscription = { is: { failedPaymentCount: { gte: 3 } } };
      break;
    case "subscription_ending":
      where.subscription = {
        is: {
          OR: [
            { cancelAtPeriodEnd: true },
            { currentPeriodEnd: { lte: sevenDaysAhead } },
          ],
        },
      };
      break;
    case "owner_inactive":
      where.users = {
        some: {
          isOwner: true,
          user: { status: { not: "ACTIVE" } },
        },
      };
      break;
    case "no_active_users":
      where.users = { none: { status: "ACTIVE" } };
      break;
    case "inactive":
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { status: "ACTIVE" },
        { activityLogs: { none: { createdAt: { gte: thirtyDaysAgo } } } },
      ];
      break;
    case "inactive_login":
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          activityLogs: {
            none: { action: "LOGIN", createdAt: { gte: fourteenDaysAgo } },
          },
        },
      ];
      break;
    case "integration_error":
      where.OR = [
        ...(where.OR ?? []),
        { marketplaceIntegrations: { some: { lastError: { not: null } } } },
        { efaturamIntegration: { lastError: { not: null } } },
      ];
      break;
    case "suspended":
      where.status = "SUSPENDED";
      break;
    default:
      break;
  }
}

export function buildAdminCompanyOrderBy(
  sort: AdminCompanyListFilters["sort"]
): Prisma.CompanyOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }];
    case "name":
      return [{ name: "asc" }];
    case "subscription_end":
      return [{ subscription: { currentPeriodEnd: "asc" } }];
    case "user_count":
      return [{ users: { _count: "desc" } }];
    case "last_activity":
      return [{ updatedAt: "desc" }];
    case "last_payment":
      return [{ updatedAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export function buildAdminCompanyListCacheKey(filters: AdminCompanyListFilters) {
  return JSON.stringify(filters);
}
