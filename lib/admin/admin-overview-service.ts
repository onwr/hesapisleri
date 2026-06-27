import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  resolveAdminOverviewPeriod,
  type AdminOverviewPeriod,
  type AdminOverviewQuery,
} from "@/lib/admin/admin-overview-period-utils";
import {
  ADMIN_OVERVIEW_METRIC_DEFINITIONS,
  buildMetric,
  formatCurrencyTotals,
  subscriptionToMonthlyMinor,
  sumCurrencyAmounts,
  type AdminOverviewMetric,
} from "@/lib/admin/admin-overview-metric-utils";
import { summarizeMembershipPaymentError } from "@/lib/admin/admin-overview-payment-labels";
import { decimalToNumber } from "@/lib/admin/admin-overview-prisma-utils";

export type AdminOverviewData = Awaited<ReturnType<typeof getAdminOverview>>;

const PAID_SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCEL_AT_PERIOD_END"] as const;
const PAST_DUE_STATUSES = ["PAST_DUE", "GRACE_PERIOD"] as const;
const CANCELLED_STATUSES = ["CANCELLED", "EXPIRED"] as const;

const NON_TRIAL_PROVIDER: Prisma.MembershipPaymentWhereInput = {
  provider: { not: "TRIAL" },
};

function paidPaymentWhere(from: Date, to: Date): Prisma.MembershipPaymentWhereInput {
  return {
    status: "PAID",
    paidAt: { gte: from, lte: to },
    ...NON_TRIAL_PROVIDER,
  };
}

function buildDateBuckets(from: Date, to: Date, mode: "day" | "month") {
  const buckets: Array<{ key: string; label: string }> = [];
  const cursor = new Date(from);

  if (mode === "month") {
    cursor.setDate(1);
    while (cursor <= to) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: new Intl.DateTimeFormat("tr-TR", {
          month: "short",
          year: "2-digit",
        }).format(cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return buckets;
  }

  const end = new Date(to);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function chooseSeriesMode(from: Date, to: Date): "day" | "month" {
  const days = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  return days > 62 ? "month" : "day";
}

function bucketKeyForDate(date: Date, mode: "day" | "month") {
  if (mode === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return date.toISOString().slice(0, 10);
}

export async function getAdminOverview(query: AdminOverviewQuery = {}) {
  const period = resolveAdminOverviewPeriod(query);
  const comparison = {
    from: period.comparisonFrom,
    to: period.comparisonTo,
  };

  const fourteenDaysAgo = new Date(period.to);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const sevenDaysAhead = new Date(period.to);
  sevenDaysAhead.setDate(sevenDaysAhead.getDate() + 7);

  const [
    totalCompanies,
    activeCompanies,
    newCompaniesCurrent,
    newCompaniesPrevious,
    trialCompanies,
    paidCompanies,
    pastDueCompanies,
    cancelledCompanies,
    paymentOverdueCompanies,
    totalUsers,
    activeUsers,
    newUsersCurrent,
    newUsersPrevious,
    loginUsersCurrent,
    loginUsersPrevious,
    paidRevenueCurrent,
    paidRevenuePrevious,
    refundedCurrent,
    refundedPrevious,
    failedCurrent,
    failedPrevious,
    activeSubscriptions,
    trialSubscriptions,
    pastDueSubscriptions,
    cancelledSubscriptions,
    subscriptionsStartedCurrent,
    subscriptionsEndedCurrent,
    mrrSubscriptions,
    revenuePaymentsCurrent,
    revenuePaymentsPrevious,
    failedPaymentsCurrent,
    refundedPaymentsCurrent,
    newCompaniesSeriesRows,
    paidConversionsSeriesRows,
    cancelledSeriesRows,
    userSignupSeriesRows,
    userLoginSeriesRows,
    attentionRows,
    recentFailedPayments,
    pendingSubscriptionPayments,
    recentRefunds,
    recurringFailedSubscriptions,
    callbackIssuePayments,
    recentLogs,
    partnerPendingApplications,
    partnerActiveCount,
    partnerReferralsCurrent,
    partnerPaidConversionsCurrent,
    partnerPendingEarnings,
    partnerPayableEarnings,
    billingOutboxFailed,
    billingOutboxPending,
    expiredSubscriptions,
    dbPing,
  ] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { status: "ACTIVE" } }),
    db.company.count({
      where: { createdAt: { gte: period.from, lte: period.to } },
    }),
    db.company.count({
      where: { createdAt: { gte: comparison.from, lte: comparison.to } },
    }),
    db.companySubscription.count({ where: { status: "TRIAL" } }),
    db.companySubscription.count({
      where: { status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
    }),
    db.companySubscription.count({
      where: { status: { in: [...PAST_DUE_STATUSES] } },
    }),
    db.companySubscription.count({
      where: { status: { in: [...CANCELLED_STATUSES] } },
    }),
    db.company.count({
      where: {
        OR: [
          { subscription: { status: { in: [...PAST_DUE_STATUSES] } } },
          {
            membershipPayments: {
              some: { status: "FAILED", createdAt: { gte: period.from, lte: period.to } },
            },
          },
        ],
      },
    }),
    db.user.count(),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({
      where: { createdAt: { gte: period.from, lte: period.to } },
    }),
    db.user.count({
      where: { createdAt: { gte: comparison.from, lte: comparison.to } },
    }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: {
        action: "LOGIN",
        createdAt: { gte: period.from, lte: period.to },
      },
    }),
    db.activityLog.groupBy({
      by: ["userId"],
      where: {
        action: "LOGIN",
        createdAt: { gte: comparison.from, lte: comparison.to },
      },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: paidPaymentWhere(period.from, period.to),
      _sum: { amount: true },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: paidPaymentWhere(comparison.from, comparison.to),
      _sum: { amount: true },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: {
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
        updatedAt: { gte: period.from, lte: period.to },
        ...NON_TRIAL_PROVIDER,
      },
      _sum: { amount: true },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: {
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
        updatedAt: { gte: comparison.from, lte: comparison.to },
        ...NON_TRIAL_PROVIDER,
      },
      _sum: { amount: true },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: {
        status: "FAILED",
        ...NON_TRIAL_PROVIDER,
        OR: [
          { failedAt: { gte: period.from, lte: period.to } },
          {
            failedAt: null,
            createdAt: { gte: period.from, lte: period.to },
          },
        ],
      },
      _sum: { amount: true },
    }),
    db.membershipPayment.groupBy({
      by: ["currency"],
      where: {
        status: "FAILED",
        ...NON_TRIAL_PROVIDER,
        OR: [
          { failedAt: { gte: comparison.from, lte: comparison.to } },
          {
            failedAt: null,
            createdAt: { gte: comparison.from, lte: comparison.to },
          },
        ],
      },
      _sum: { amount: true },
    }),
    db.companySubscription.count({
      where: { status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
    }),
    db.companySubscription.count({ where: { status: "TRIAL" } }),
    db.companySubscription.count({
      where: { status: { in: [...PAST_DUE_STATUSES] } },
    }),
    db.companySubscription.count({
      where: { status: { in: [...CANCELLED_STATUSES] } },
    }),
    db.companySubscription.count({
      where: { createdAt: { gte: period.from, lte: period.to } },
    }),
    db.companySubscription.count({
      where: {
        OR: [
          { cancelledAt: { gte: period.from, lte: period.to } },
          {
            status: { in: [...CANCELLED_STATUSES] },
            updatedAt: { gte: period.from, lte: period.to },
          },
        ],
      },
    }),
    db.companySubscription.findMany({
      where: { status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
      select: {
        billingInterval: true,
        lockedPriceMinor: true,
        lockedPlanPrice: {
          select: { salePriceMinor: true, monthlyEquivalentMinor: true },
        },
      },
    }),
    db.membershipPayment.findMany({
      where: {
        OR: [
          paidPaymentWhere(period.from, period.to),
          {
            status: "FAILED",
            failedAt: { gte: period.from, lte: period.to },
            ...NON_TRIAL_PROVIDER,
          },
          {
            status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
            updatedAt: { gte: period.from, lte: period.to },
            ...NON_TRIAL_PROVIDER,
          },
        ],
      },
      select: {
        status: true,
        amount: true,
        currency: true,
        paidAt: true,
        failedAt: true,
        updatedAt: true,
      },
    }),
    db.membershipPayment.findMany({
      where: paidPaymentWhere(comparison.from, comparison.to),
      select: { amount: true, currency: true, paidAt: true },
    }),
    db.membershipPayment.findMany({
      where: {
        status: "FAILED",
        failedAt: { gte: period.from, lte: period.to },
        ...NON_TRIAL_PROVIDER,
      },
      select: { amount: true, currency: true, failedAt: true },
    }),
    db.membershipPayment.findMany({
      where: {
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
        updatedAt: { gte: period.from, lte: period.to },
        ...NON_TRIAL_PROVIDER,
      },
      select: { amount: true, currency: true, updatedAt: true },
    }),
    db.company.findMany({
      where: { createdAt: { gte: period.from, lte: period.to } },
      select: { createdAt: true },
    }),
    db.companySubscription.findMany({
      where: {
        status: { in: [...PAID_SUBSCRIPTION_STATUSES] },
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { createdAt: true },
    }),
    db.companySubscription.findMany({
      where: {
        cancelledAt: { gte: period.from, lte: period.to },
      },
      select: { cancelledAt: true },
    }),
    db.user.findMany({
      where: { createdAt: { gte: period.from, lte: period.to } },
      select: { createdAt: true },
    }),
    db.activityLog.findMany({
      where: {
        action: "LOGIN",
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { userId: true, createdAt: true },
    }),
    buildAttentionCompanies({
      periodTo: period.to,
      sevenDaysAhead,
      fourteenDaysAgo,
    }),
    db.membershipPayment.findMany({
      where: {
        status: "FAILED",
        ...NON_TRIAL_PROVIDER,
      },
      orderBy: { failedAt: "desc" },
      take: 10,
      include: { company: true, plan: true },
    }),
    db.membershipPayment.findMany({
      where: {
        status: { in: ["PENDING", "WAIT_CALLBACK", "UNKNOWN"] },
        ...NON_TRIAL_PROVIDER,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { company: true, plan: true },
    }),
    db.membershipPayment.findMany({
      where: {
        status: { in: ["REFUNDED", "PARTIALLY_REFUNDED"] },
        ...NON_TRIAL_PROVIDER,
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { company: true, plan: true },
    }),
    db.companySubscription.findMany({
      where: { failedPaymentCount: { gte: 3 } },
      orderBy: { lastPaymentFailureAt: "desc" },
      take: 10,
      include: { company: true, plan: true },
    }),
    db.membershipPayment.findMany({
      where: {
        status: { in: ["WAIT_CALLBACK", "UNKNOWN"] },
        callbackReceivedAt: null,
        createdAt: { lte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        ...NON_TRIAL_PROVIDER,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { company: true, plan: true },
    }),
    db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: true, company: true },
    }),
    db.partnerApplication.count({ where: { status: "PENDING" } }),
    db.partnerProfile.count({ where: { status: "ACTIVE" } }),
    db.partnerConversion.count({
      where: { createdAt: { gte: period.from, lte: period.to } },
    }),
    db.partnerConversion.count({
      where: {
        createdAt: { gte: period.from, lte: period.to },
        type: { in: ["PAID_MEMBERSHIP", "RENEWAL"] },
        status: "APPROVED",
      },
    }),
    db.partnerEarning.aggregate({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
    }),
    db.partnerEarning.aggregate({
      where: { status: "PAYABLE" },
      _sum: { amount: true },
    }),
    db.billingOutboxEvent.count({ where: { status: "FAILED" } }),
    db.billingOutboxEvent.count({ where: { status: "PENDING" } }),
    db.companySubscription.count({ where: { status: "EXPIRED" } }),
    db.$queryRaw`SELECT 1`,
  ]);

  const paidCurrentTotals = sumCurrencyAmounts(
    paidRevenueCurrent.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );
  const paidPreviousTotals = sumCurrencyAmounts(
    paidRevenuePrevious.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );
  const refundedTotals = sumCurrencyAmounts(
    refundedCurrent.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );
  const refundedPreviousTotals = sumCurrencyAmounts(
    refundedPrevious.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );
  const failedTotals = sumCurrencyAmounts(
    failedCurrent.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );
  const failedPreviousTotals = sumCurrencyAmounts(
    failedPrevious.map((row) => ({
      currency: row.currency,
      amount: decimalToNumber(row._sum.amount),
    }))
  );

  const paidCurrentValue = paidCurrentTotals.reduce((sum, row) => sum + row.amount, 0);
  const paidPreviousValue = paidPreviousTotals.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const refundedValue = refundedTotals.reduce((sum, row) => sum + row.amount, 0);
  const refundedPreviousValue = refundedPreviousTotals.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const failedValue = failedTotals.reduce((sum, row) => sum + row.amount, 0);
  const failedPreviousValue = failedPreviousTotals.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  const mrrByCurrency = sumCurrencyAmounts(
    mrrSubscriptions.map((subscription) => {
      const monthlyMinor = subscriptionToMonthlyMinor({
        billingInterval: subscription.billingInterval,
        lockedPriceMinor: subscription.lockedPriceMinor,
        monthlyEquivalentMinor: subscription.lockedPlanPrice?.monthlyEquivalentMinor,
        amountMinor: subscription.lockedPlanPrice?.salePriceMinor,
      });
      return { currency: "TRY", amount: monthlyMinor / 100 };
    })
  );
  const mrrValue = mrrByCurrency.reduce((sum, row) => sum + row.amount, 0);
  const arrValue = mrrValue * 12;

  const metrics = buildOverviewMetrics({
    period,
    totalCompanies,
    activeCompanies,
    newCompaniesCurrent,
    newCompaniesPrevious,
    trialCompanies,
    paidCompanies,
    pastDueCompanies,
    paymentOverdueCompanies,
    cancelledCompanies,
    totalUsers,
    activeUsers,
    newUsersCurrent,
    newUsersPrevious,
    loginUsersCurrent: loginUsersCurrent.length,
    loginUsersPrevious: loginUsersPrevious.length,
    paidCurrentValue,
    paidPreviousValue,
    paidCurrentTotals,
    paidPreviousTotals,
    refundedValue,
    refundedPreviousValue,
    refundedTotals,
    failedValue,
    failedPreviousValue,
    failedTotals,
    mrrValue,
    arrValue,
    activeSubscriptions,
    trialSubscriptions,
    pastDueSubscriptions,
    cancelledSubscriptions,
    subscriptionsStartedCurrent,
    subscriptionsEndedCurrent,
  });

  const seriesMode = chooseSeriesMode(period.from, period.to);
  const revenueSeries = buildRevenueSeries(
    period,
    revenuePaymentsCurrent,
    revenuePaymentsPrevious,
    seriesMode
  );
  const companyGrowthSeries = buildCompanyGrowthSeries(
    period,
    newCompaniesSeriesRows,
    paidConversionsSeriesRows,
    cancelledSeriesRows,
    seriesMode
  );
  const subscriptionDistribution = buildSubscriptionDistribution({
    active: activeSubscriptions,
    trial: trialSubscriptions,
    pastDue: pastDueSubscriptions,
    cancelled: cancelledSubscriptions,
    expired: expiredSubscriptions,
  });
  const userActivitySeries = buildUserActivitySeries(
    period,
    userSignupSeriesRows,
    userLoginSeriesRows.filter(
      (row): row is { userId: string; createdAt: Date } => Boolean(row.userId)
    ),
    seriesMode
  );

  const paymentIssues = buildPaymentIssues({
    failed: recentFailedPayments,
    pending: pendingSubscriptionPayments,
    refunds: recentRefunds,
    recurring: recurringFailedSubscriptions,
    callbackIssues: callbackIssuePayments,
  });

  const recentPlatformActivity = mapPlatformActivity(recentLogs);
  const partnerSummary = {
    pendingApplications: partnerPendingApplications,
    activePartners: partnerActiveCount,
    referralsInPeriod: partnerReferralsCurrent,
    paidConversionsInPeriod: partnerPaidConversionsCurrent,
    pendingEarnings: decimalToNumber(partnerPendingEarnings._sum.amount),
    payableEarnings: decimalToNumber(partnerPayableEarnings._sum.amount),
    links: {
      partners: "/admin/partners",
      applications: "/admin/partners/applications",
      payouts: "/admin/partners/payouts",
    },
  };

  const systemSummary = buildSystemSummary({
    dbOk: Boolean(dbPing),
    failedJobs: billingOutboxFailed,
    pendingJobs: billingOutboxPending,
  });

  return {
    period: {
      key: period.key,
      label: period.label,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
      timezone: period.timezone,
    },
    comparisonPeriod: {
      from: comparison.from.toISOString(),
      to: comparison.to.toISOString(),
    },
    metrics,
    revenueSeries,
    companyGrowthSeries,
    subscriptionDistribution,
    userActivitySeries,
    companiesRequiringAttention: attentionRows,
    paymentIssues,
    recentPlatformActivity,
    partnerSummary,
    systemSummary,
  };
}

async function buildAttentionCompanies(input: {
  periodTo: Date;
  sevenDaysAhead: Date;
  fourteenDaysAgo: Date;
}) {
  const [trialEnding, pastDue, suspended, inactive, recurringFailed] =
    await Promise.all([
      db.companySubscription.findMany({
        where: {
          status: "TRIAL",
          trialEndsAt: { lte: input.sevenDaysAhead },
        },
        take: 8,
        orderBy: { trialEndsAt: "asc" },
        include: {
          company: {
            include: {
              users: { where: { isOwner: true }, include: { user: true }, take: 1 },
            },
          },
          plan: true,
        },
      }),
      db.companySubscription.findMany({
        where: { status: { in: [...PAST_DUE_STATUSES] } },
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          company: {
            include: {
              users: { where: { isOwner: true }, include: { user: true }, take: 1 },
            },
          },
          plan: true,
        },
      }),
      db.company.findMany({
        where: { status: "SUSPENDED" },
        take: 5,
        include: {
          users: { where: { isOwner: true }, include: { user: true }, take: 1 },
          subscription: { include: { plan: true } },
        },
      }),
      db.company.findMany({
        where: {
          status: "ACTIVE",
          activityLogs: { none: { createdAt: { gte: input.fourteenDaysAgo } } },
        },
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          users: { where: { isOwner: true }, include: { user: true }, take: 1 },
          subscription: { include: { plan: true } },
        },
      }),
      db.companySubscription.findMany({
        where: { failedPaymentCount: { gte: 3 } },
        take: 5,
        include: {
          company: {
            include: {
              users: { where: { isOwner: true }, include: { user: true }, take: 1 },
            },
          },
          plan: true,
        },
      }),
    ]);

  type AttentionRow = {
    id: string;
    companyId: string;
    companyName: string;
    ownerName: string;
    planName: string | null;
    subscriptionStatus: string;
    lastPaymentAt: string | null;
    lastActivityAt: string | null;
    issue: string;
    issueCode: string;
    actions: {
      companyHref: string;
      subscriptionHref: string | null;
      paymentsHref: string;
      usersHref: string;
    };
  };

  const rows: AttentionRow[] = [];
  const seen = new Set<string>();

  function pushRow(row: AttentionRow) {
    if (seen.has(row.companyId)) return;
    seen.add(row.companyId);
    rows.push(row);
  }

  for (const sub of trialEnding) {
    pushRow({
      id: `trial-${sub.companyId}`,
      companyId: sub.companyId,
      companyName: sub.company.name,
      ownerName: sub.company.users[0]?.user.name ?? "—",
      planName: sub.plan?.name ?? null,
      subscriptionStatus: sub.status,
      lastPaymentAt: sub.lastPaymentAttemptAt?.toISOString() ?? null,
      lastActivityAt: sub.company.updatedAt.toISOString(),
      issue: "Deneme süresi 7 gün içinde bitiyor",
      issueCode: "trial_ending",
      actions: {
        companyHref: `/admin/companies/${sub.companyId}`,
        subscriptionHref: `/admin/subscriptions?companyId=${sub.companyId}`,
        paymentsHref: `/admin/payments?status=FAILED&companyId=${sub.companyId}`,
        usersHref: `/admin/users?companyId=${sub.companyId}`,
      },
    });
  }

  for (const sub of pastDue) {
    pushRow({
      id: `past-due-${sub.companyId}`,
      companyId: sub.companyId,
      companyName: sub.company.name,
      ownerName: sub.company.users[0]?.user.name ?? "—",
      planName: sub.plan?.name ?? null,
      subscriptionStatus: sub.status,
      lastPaymentAt: sub.lastPaymentFailureAt?.toISOString() ?? null,
      lastActivityAt: sub.company.updatedAt.toISOString(),
      issue: "Ödemesi gecikmiş abonelik",
      issueCode: "past_due",
      actions: {
        companyHref: `/admin/companies/${sub.companyId}`,
        subscriptionHref: `/admin/subscriptions?status=PAST_DUE&q=${encodeURIComponent(sub.company.name)}`,
        paymentsHref: `/admin/payments?status=FAILED&companyId=${sub.companyId}`,
        usersHref: `/admin/users?companyId=${sub.companyId}`,
      },
    });
  }

  for (const company of suspended) {
    pushRow({
      id: `suspended-${company.id}`,
      companyId: company.id,
      companyName: company.name,
      ownerName: company.users[0]?.user.name ?? "—",
      planName: company.subscription?.plan?.name ?? null,
      subscriptionStatus: company.subscription?.status ?? "SUSPENDED",
      lastPaymentAt: null,
      lastActivityAt: company.updatedAt.toISOString(),
      issue: "Hesap askıya alınmış",
      issueCode: "suspended",
      actions: {
        companyHref: `/admin/companies/${company.id}`,
        subscriptionHref: company.subscription
          ? `/admin/subscriptions?companyId=${company.id}`
          : null,
        paymentsHref: `/admin/payments?companyId=${company.id}`,
        usersHref: `/admin/users?companyId=${company.id}`,
      },
    });
  }

  for (const company of inactive) {
    pushRow({
      id: `inactive-${company.id}`,
      companyId: company.id,
      companyName: company.name,
      ownerName: company.users[0]?.user.name ?? "—",
      planName: company.subscription?.plan?.name ?? null,
      subscriptionStatus: company.subscription?.status ?? "—",
      lastPaymentAt: null,
      lastActivityAt: company.updatedAt.toISOString(),
      issue: "14+ gündür platform aktivitesi yok",
      issueCode: "inactive",
      actions: {
        companyHref: `/admin/companies/${company.id}`,
        subscriptionHref: company.subscription
          ? `/admin/subscriptions?companyId=${company.id}`
          : null,
        paymentsHref: `/admin/payments?companyId=${company.id}`,
        usersHref: `/admin/users?companyId=${company.id}`,
      },
    });
  }

  for (const sub of recurringFailed) {
    pushRow({
      id: `failed-count-${sub.companyId}`,
      companyId: sub.companyId,
      companyName: sub.company.name,
      ownerName: sub.company.users[0]?.user.name ?? "—",
      planName: sub.plan?.name ?? null,
      subscriptionStatus: sub.status,
      lastPaymentAt: sub.lastPaymentFailureAt?.toISOString() ?? null,
      lastActivityAt: sub.company.updatedAt.toISOString(),
      issue: "Çok sayıda başarısız ödeme girişimi",
      issueCode: "recurring_failed",
      actions: {
        companyHref: `/admin/companies/${sub.companyId}`,
        subscriptionHref: `/admin/subscriptions?companyId=${sub.companyId}`,
        paymentsHref: `/admin/payments?status=FAILED&companyId=${sub.companyId}`,
        usersHref: `/admin/users?companyId=${sub.companyId}`,
      },
    });
  }

  return rows.slice(0, 15);
}

function buildOverviewMetrics(input: {
  period: AdminOverviewPeriod;
  totalCompanies: number;
  activeCompanies: number;
  newCompaniesCurrent: number;
  newCompaniesPrevious: number;
  trialCompanies: number;
  paidCompanies: number;
  pastDueCompanies: number;
  paymentOverdueCompanies: number;
  cancelledCompanies: number;
  totalUsers: number;
  activeUsers: number;
  newUsersCurrent: number;
  newUsersPrevious: number;
  loginUsersCurrent: number;
  loginUsersPrevious: number;
  paidCurrentValue: number;
  paidPreviousValue: number;
  paidCurrentTotals: Array<{ currency: string; amount: number }>;
  paidPreviousTotals: Array<{ currency: string; amount: number }>;
  refundedValue: number;
  refundedPreviousValue: number;
  refundedTotals: Array<{ currency: string; amount: number }>;
  failedValue: number;
  failedPreviousValue: number;
  failedTotals: Array<{ currency: string; amount: number }>;
  mrrValue: number;
  arrValue: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pastDueSubscriptions: number;
  cancelledSubscriptions: number;
  subscriptionsStartedCurrent: number;
  subscriptionsEndedCurrent: number;
}): AdminOverviewMetric[] {
  const defs = ADMIN_OVERVIEW_METRIC_DEFINITIONS;

  return [
    buildMetric({
      key: "companies_total",
      group: "companies",
      label: "Toplam Firma",
      description: defs.companies.total,
      value: input.totalCompanies,
      previousValue: input.totalCompanies,
      href: "/admin/companies",
    }),
    buildMetric({
      key: "companies_active",
      group: "companies",
      label: "Aktif Firma",
      description: defs.companies.active,
      value: input.activeCompanies,
      previousValue: input.activeCompanies,
      href: "/admin/companies?status=ACTIVE",
    }),
    buildMetric({
      key: "companies_new",
      group: "companies",
      label: "Yeni Firma",
      description: defs.companies.newInPeriod,
      value: input.newCompaniesCurrent,
      previousValue: input.newCompaniesPrevious,
      href: `/admin/companies?${buildAdminCompaniesRangeQuery(input.period)}`,
    }),
    buildMetric({
      key: "companies_trial",
      group: "companies",
      label: "Deneme Sürecinde",
      description: defs.companies.trial,
      value: input.trialCompanies,
      previousValue: input.trialCompanies,
      href: "/admin/subscriptions?status=TRIAL",
    }),
    buildMetric({
      key: "companies_paid",
      group: "companies",
      label: "Ücretli Firma",
      description: defs.companies.paid,
      value: input.paidCompanies,
      previousValue: input.paidCompanies,
      href: "/admin/subscriptions?status=ACTIVE",
    }),
    buildMetric({
      key: "companies_past_due",
      group: "companies",
      label: "Ödemesi Geciken",
      description: defs.companies.pastDue,
      value: input.pastDueCompanies,
      previousValue: input.pastDueCompanies,
      href: "/admin/subscriptions?status=PAST_DUE",
    }),
    buildMetric({
      key: "companies_payment_overdue",
      group: "companies",
      label: "Ödeme Sorunu",
      description: defs.companies.paymentOverdue,
      value: input.paymentOverdueCompanies,
      previousValue: input.paymentOverdueCompanies,
      href: "/admin/payments?status=FAILED",
    }),
    buildMetric({
      key: "companies_cancelled",
      group: "companies",
      label: "İptal Abonelik",
      description: defs.companies.cancelled,
      value: input.cancelledCompanies,
      previousValue: input.cancelledCompanies,
      href: "/admin/subscriptions?status=CANCELLED",
    }),
    buildMetric({
      key: "users_total",
      group: "users",
      label: "Toplam Kullanıcı",
      description: defs.users.total,
      value: input.totalUsers,
      previousValue: input.totalUsers,
      href: "/admin/users",
    }),
    buildMetric({
      key: "users_active",
      group: "users",
      label: "Aktif Kullanıcı",
      description: defs.users.active,
      value: input.activeUsers,
      previousValue: input.activeUsers,
      href: "/admin/users?status=ACTIVE",
    }),
    buildMetric({
      key: "users_logged_in",
      group: "users",
      label: "Giriş Yapan",
      description: defs.users.loggedInPeriod,
      value: input.loginUsersCurrent,
      previousValue: input.loginUsersPrevious,
      href: "/admin/system-logs?action=LOGIN",
    }),
    buildMetric({
      key: "users_new",
      group: "users",
      label: "Yeni Kullanıcı",
      description: defs.users.newInPeriod,
      value: input.newUsersCurrent,
      previousValue: input.newUsersPrevious,
      href: "/admin/users",
    }),
    buildMetric({
      key: "revenue_collected",
      group: "revenue",
      label: "Tahsil Edilen Gelir",
      description: defs.revenue.collected,
      value: input.paidCurrentValue,
      previousValue: input.paidPreviousValue,
      format: "money",
      href: "/admin/payments?status=PAID",
    }),
    buildMetric({
      key: "revenue_mrr",
      group: "revenue",
      label: "MRR",
      description: defs.revenue.mrr,
      value: input.mrrValue,
      previousValue: input.mrrValue,
      format: "money",
      href: "/admin/subscriptions?status=ACTIVE",
    }),
    buildMetric({
      key: "revenue_arr",
      group: "revenue",
      label: "ARR",
      description: defs.revenue.arr,
      value: input.arrValue,
      previousValue: input.arrValue,
      format: "money",
      href: "/admin/subscriptions?status=ACTIVE",
    }),
    buildMetric({
      key: "revenue_refunded",
      group: "revenue",
      label: "İade Tutarı",
      description: defs.revenue.refunded,
      value: input.refundedValue,
      previousValue: input.refundedPreviousValue,
      format: "money",
      href: "/admin/payments?status=REFUNDED",
    }),
    buildMetric({
      key: "revenue_failed",
      group: "revenue",
      label: "Başarısız Ödeme",
      description: defs.revenue.failed,
      value: input.failedValue,
      previousValue: input.failedPreviousValue,
      format: "money",
      href: "/admin/payments?status=FAILED",
    }),
    buildMetric({
      key: "subscriptions_active",
      group: "subscriptions",
      label: "Aktif Abonelik",
      description: defs.subscriptions.active,
      value: input.activeSubscriptions,
      previousValue: input.activeSubscriptions,
      href: "/admin/subscriptions?status=ACTIVE",
    }),
    buildMetric({
      key: "subscriptions_trial",
      group: "subscriptions",
      label: "Trial Abonelik",
      description: defs.subscriptions.trial,
      value: input.trialSubscriptions,
      previousValue: input.trialSubscriptions,
      href: "/admin/subscriptions?status=TRIAL",
    }),
    buildMetric({
      key: "subscriptions_past_due",
      group: "subscriptions",
      label: "Past Due",
      description: defs.subscriptions.pastDue,
      value: input.pastDueSubscriptions,
      previousValue: input.pastDueSubscriptions,
      href: "/admin/subscriptions?status=PAST_DUE",
    }),
    buildMetric({
      key: "subscriptions_cancelled",
      group: "subscriptions",
      label: "Cancelled",
      description: defs.subscriptions.cancelled,
      value: input.cancelledSubscriptions,
      previousValue: input.cancelledSubscriptions,
      href: "/admin/subscriptions?status=CANCELLED",
    }),
    buildMetric({
      key: "subscriptions_started",
      group: "subscriptions",
      label: "Dönemde Başlayan",
      description: defs.subscriptions.startedInPeriod,
      value: input.subscriptionsStartedCurrent,
      previousValue: 0,
      href: "/admin/subscriptions",
    }),
    buildMetric({
      key: "subscriptions_ended",
      group: "subscriptions",
      label: "Dönemde Sona Eren",
      description: defs.subscriptions.endedInPeriod,
      value: input.subscriptionsEndedCurrent,
      previousValue: 0,
      href: "/admin/subscriptions?status=CANCELLED",
    }),
  ].map((metric) => {
    if (metric.key === "revenue_collected" && input.paidCurrentTotals.length > 1) {
      return {
        ...metric,
        formattedValue: formatCurrencyTotals(input.paidCurrentTotals),
        description: `${metric.description} (${input.paidCurrentTotals
          .map((item) => item.currency)
          .join(", ")})`,
      };
    }
    return metric;
  });
}

function buildAdminCompaniesRangeQuery(period: AdminOverviewPeriod) {
  return `createdFrom=${period.from.toISOString().slice(0, 10)}&createdTo=${period.to.toISOString().slice(0, 10)}`;
}

function buildRevenueSeries(
  period: AdminOverviewPeriod,
  rows: Array<{
    status: string;
    amount: Prisma.Decimal;
    currency: string;
    paidAt: Date | null;
    failedAt: Date | null;
    updatedAt: Date;
  }>,
  comparisonRows: Array<{
    amount: Prisma.Decimal;
    paidAt: Date | null;
  }>,
  mode: "day" | "month"
) {
  const buckets = buildDateBuckets(period.from, period.to, mode);
  const points = buckets.map((bucket) => ({
    label: bucket.label,
    paid: 0,
    failed: 0,
    refunded: 0,
    comparisonPaid: 0,
  }));
  const bucketMap = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const row of rows) {
    const date =
      row.status === "PAID"
        ? row.paidAt
        : row.status === "FAILED"
          ? row.failedAt
          : row.updatedAt;
    if (!date) continue;
    const index = bucketMap.get(bucketKeyForDate(date, mode));
    if (index === undefined) continue;
    const amount = decimalToNumber(row.amount);
    if (row.status === "PAID") points[index]!.paid += amount;
    if (row.status === "FAILED") points[index]!.failed += amount;
    if (row.status === "REFUNDED" || row.status === "PARTIALLY_REFUNDED") {
      points[index]!.refunded += amount;
    }
  }

  const comparisonTotal = comparisonRows.reduce(
    (sum, row) => sum + decimalToNumber(row.amount),
    0
  );
  const comparisonPerBucket =
    points.length > 0 ? comparisonTotal / points.length : 0;
  for (const point of points) {
    point.comparisonPaid = comparisonPerBucket;
  }

  return points;
}

function buildCompanyGrowthSeries(
  period: AdminOverviewPeriod,
  newCompanies: Array<{ createdAt: Date }>,
  paidConversions: Array<{ createdAt: Date }>,
  cancelled: Array<{ cancelledAt: Date | null }>,
  mode: "day" | "month"
) {
  const buckets = buildDateBuckets(period.from, period.to, mode);
  const points = buckets.map((bucket) => ({
    label: bucket.label,
    newCompanies: 0,
    paidConversions: 0,
    cancelled: 0,
  }));
  const bucketMap = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const row of newCompanies) {
    const index = bucketMap.get(bucketKeyForDate(row.createdAt, mode));
    if (index !== undefined) points[index]!.newCompanies += 1;
  }
  for (const row of paidConversions) {
    const index = bucketMap.get(bucketKeyForDate(row.createdAt, mode));
    if (index !== undefined) points[index]!.paidConversions += 1;
  }
  for (const row of cancelled) {
    if (!row.cancelledAt) continue;
    const index = bucketMap.get(bucketKeyForDate(row.cancelledAt, mode));
    if (index !== undefined) points[index]!.cancelled += 1;
  }

  return points;
}

function buildSubscriptionDistribution(input: {
  active: number;
  trial: number;
  pastDue: number;
  cancelled: number;
  expired: number;
}) {
  return [
    { key: "active", label: "Aktif", value: input.active },
    { key: "trial", label: "Trial", value: input.trial },
    { key: "past_due", label: "Past Due", value: input.pastDue },
    { key: "cancelled", label: "Cancelled", value: input.cancelled },
    { key: "expired", label: "Expired", value: input.expired },
  ];
}

function buildUserActivitySeries(
  period: AdminOverviewPeriod,
  signups: Array<{ createdAt: Date }>,
  logins: Array<{ userId: string; createdAt: Date }>,
  mode: "day" | "month"
) {
  const buckets = buildDateBuckets(period.from, period.to, mode);
  const points = buckets.map((bucket) => ({
    label: bucket.label,
    newUsers: 0,
    logins: 0,
    activeUsers: 0,
  }));
  const bucketMap = new Map(buckets.map((bucket, index) => [bucket.key, index]));
  const activeByBucket = new Map<number, Set<string>>();

  for (const row of signups) {
    const index = bucketMap.get(bucketKeyForDate(row.createdAt, mode));
    if (index !== undefined) points[index]!.newUsers += 1;
  }

  for (const row of logins) {
    const index = bucketMap.get(bucketKeyForDate(row.createdAt, mode));
    if (index === undefined) continue;
    points[index]!.logins += 1;
    const set = activeByBucket.get(index) ?? new Set<string>();
    set.add(row.userId);
    activeByBucket.set(index, set);
  }

  for (const [index, users] of activeByBucket.entries()) {
    points[index]!.activeUsers = users.size;
  }

  return points;
}

function buildPaymentIssues(input: {
  failed: Array<
    Awaited<ReturnType<typeof db.membershipPayment.findMany>>[number] & {
      company: { id: string; name: string };
      plan: { name: string } | null;
    }
  >;
  pending: Array<
    Awaited<ReturnType<typeof db.membershipPayment.findMany>>[number] & {
      company: { id: string; name: string };
      plan: { name: string } | null;
    }
  >;
  refunds: Array<
    Awaited<ReturnType<typeof db.membershipPayment.findMany>>[number] & {
      company: { id: string; name: string };
      plan: { name: string } | null;
    }
  >;
  recurring: Array<
    Awaited<ReturnType<typeof db.companySubscription.findMany>>[number] & {
      company: { id: string; name: string };
      plan: { name: string } | null;
    }
  >;
  callbackIssues: Array<
    Awaited<ReturnType<typeof db.membershipPayment.findMany>>[number] & {
      company: { id: string; name: string };
      plan: { name: string } | null;
    }
  >;
}) {
  const mapPayment = (
    payment: (typeof input.failed)[number],
    issue: string
  ) => ({
    id: payment.id,
    companyId: payment.company.id,
    companyName: payment.company.name,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    planName: payment.plan?.name ?? "Standart Paket",
    provider: payment.providerEnum ?? payment.provider ?? "—",
    status: payment.status,
    errorSummary: summarizeMembershipPaymentError(payment),
    issue,
    date:
      payment.failedAt?.toISOString() ??
      payment.updatedAt.toISOString() ??
      payment.createdAt.toISOString(),
    href: `/admin/payments?status=${payment.status}&companyId=${payment.company.id}`,
    companyHref: `/admin/companies/${payment.company.id}`,
  });

  return {
    failed: input.failed.map((payment) =>
      mapPayment(payment, "Son başarısız ödeme")
    ),
    pending: input.pending.map((payment) =>
      mapPayment(payment, "Ödeme bekleyen abonelik")
    ),
    refunds: input.refunds.map((payment) =>
      mapPayment(payment, "İade edilmiş ödeme")
    ),
    recurring: input.recurring.map((subscription) => ({
      id: subscription.id,
      companyId: subscription.companyId,
      companyName: subscription.company.name,
      planName: subscription.plan?.name ?? null,
      failedPaymentCount: subscription.failedPaymentCount,
      issue: "Tekrarlayan ödeme hatası",
      date: subscription.lastPaymentFailureAt?.toISOString() ?? null,
      href: `/admin/subscriptions?companyId=${subscription.companyId}`,
      companyHref: `/admin/companies/${subscription.companyId}`,
    })),
    callbackIssues: input.callbackIssues.map((payment) =>
      mapPayment(payment, "PayTR callback / senkronizasyon sorunu")
    ),
  };
}

function mapPlatformActivity(
  logs: Prisma.ActivityLogGetPayload<{
    include: { user: true; company: true };
  }>[]
) {
  return logs.map((log) => ({
    id: log.id,
    type: `${log.module}:${log.action}`,
    title: log.message ?? `${log.module} ${log.action}`,
    actorName: log.user?.name ?? "Sistem",
    companyName: log.company?.name ?? null,
    companyId: log.companyId,
    createdAt: log.createdAt.toISOString(),
    href: resolveActivityHref(log),
  }));
}

function resolveActivityHref(log: {
  module: string;
  action: string;
  companyId: string | null;
  message: string | null;
}) {
  if (log.module === "admin") return "/admin/system-logs";
  if (log.module === "partner") return "/admin/partners/applications";
  if (log.companyId) return `/admin/companies/${log.companyId}`;
  if (log.module === "membership" || log.module === "billing") {
    return "/admin/payments";
  }
  return "/admin/system-logs";
}

function buildSystemSummary(input: {
  dbOk: boolean;
  failedJobs: number;
  pendingJobs: number;
}) {
  return {
    database: input.dbOk
      ? { status: "ok" as const, label: "Erişilebilir" }
      : { status: "error" as const, label: "Bağlantı hatası" },
    application: {
      status: "not_configured" as const,
      label: "Henüz yapılandırılmadı",
      href: "/admin/system/health",
    },
    lastCronRun: {
      status: "not_configured" as const,
      label: "Henüz yapılandırılmadı",
      href: "/admin/system/jobs",
    },
    failedJobs: {
      status: input.failedJobs > 0 ? ("warning" as const) : ("ok" as const),
      label: String(input.failedJobs),
      href: "/admin/system/jobs",
    },
    pendingJobs: {
      status: input.pendingJobs > 0 ? ("warning" as const) : ("ok" as const),
      label: String(input.pendingJobs),
      href: "/admin/system/jobs",
    },
    lastCriticalError: {
      status: "not_configured" as const,
      label: "Henüz yapılandırılmadı",
      href: "/admin/system/logs",
    },
  };
}
