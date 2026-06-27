import type { Prisma } from "@prisma/client";
import type { AdminSubListQuery } from "@/lib/admin/subscriptions/admin-subscription-schemas";

export function buildSubscriptionListWhere(
  query: AdminSubListQuery
): Prisma.CompanySubscriptionWhereInput {
  const now = new Date();
  const where: Prisma.CompanySubscriptionWhereInput = {};

  // Status filter
  if (query.status !== "ALL") {
    where.status = query.status;
  }

  // Plan filter
  if (query.planId) {
    where.planId = query.planId;
  }

  // Billing interval filter
  if (query.billingInterval !== "ALL") {
    where.billingInterval = query.billingInterval;
  }

  // Search: firma adı, plan adı, abonelik ID, sahip email/ad
  if (query.q && query.q.trim().length >= 2) {
    const q = query.q.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { plan: { name: { contains: q, mode: "insensitive" } } },
      { plan: { code: { contains: q, mode: "insensitive" } } },
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
  }

  // Issue filters
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (query.issue) {
    switch (query.issue) {
      case "trial_ending_7d":
        where.status = "TRIAL";
        where.trialEndsAt = { gte: now, lte: in7Days };
        break;
      case "ending_7d":
        where.status = { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] };
        where.currentPeriodEnd = { gte: now, lte: in7Days };
        break;
      case "past_due":
        where.status = "PAST_DUE";
        break;
      case "payment_failed":
        where.failedPaymentCount = { gt: 0 };
        break;
      case "three_plus_failed":
        where.failedPaymentCount = { gte: 3 };
        break;
      case "no_plan":
        where.planId = null;
        break;
      case "cancellation_scheduled":
        where.cancelAtPeriodEnd = true;
        break;
    }
  }

  // Date range filter
  if (query.dateRange !== "ALL") {
    const ranges: Record<string, Date> = {
      TODAY: new Date(now.setHours(0, 0, 0, 0)),
      LAST_7D: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      LAST_30D: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      THIS_MONTH: new Date(now.getFullYear(), now.getMonth(), 1),
    };
    const from = ranges[query.dateRange];
    if (from) {
      where.createdAt = { gte: from };
    }
  }

  return where;
}

export function buildSubscriptionOrderBy(
  query: AdminSubListQuery
): Prisma.CompanySubscriptionOrderByWithRelationInput {
  const dir = query.sortDir;
  switch (query.sortBy) {
    case "companyName":
      return { company: { name: dir } };
    case "planName":
      return { plan: { name: dir } };
    case "status":
      return { status: dir };
    case "currentPeriodEnd":
      return { currentPeriodEnd: dir };
    case "trialEndsAt":
      return { trialEndsAt: dir };
    case "lastPaymentAt":
      return { lastPaymentAttemptAt: dir };
    case "createdAt":
    default:
      return { createdAt: dir };
  }
}
