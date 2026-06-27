import "server-only";
import { db } from "@/lib/prisma";
import {
  detectSubscriptionIssues,
  detectSubscriptionIssuesForCompany,
  getIssueLabel,
  ISSUE_TAB_LINKS,
  type SubscriptionIssue,
} from "@/lib/admin/subscriptions/admin-subscription-issue-service";
import { maskProviderRef } from "@/lib/admin/subscriptions/admin-subscription-serializers";

export type AdminSubscriptionTab =
  | "overview"
  | "payments"
  | "history"
  | "entitlements"
  | "addons"
  | "activity"
  | "notes";

const VALID_TABS: AdminSubscriptionTab[] = [
  "overview", "payments", "history", "entitlements", "addons", "activity", "notes",
];

export function resolveSubscriptionTab(raw: string | undefined): AdminSubscriptionTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as AdminSubscriptionTab;
  return "overview";
}

export async function getAdminSubscriptionHeader(subscriptionId: string) {
  const sub = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      company: {
        include: {
          users: {
            where: { isOwner: true },
            take: 1,
            include: { user: { select: { name: true, email: true } } },
          },
        },
      },
      plan: { select: { id: true, name: true, code: true } },
      lockedPlanPrice: {
        select: { currency: true, monthlyEquivalentMinor: true, billingInterval: true },
      },
    },
  });

  if (!sub) return null;

  const [lastPayment, noteCount, pendingChange] = await Promise.all([
    db.membershipPayment.findFirst({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
      select: { status: true, amount: true, currency: true, paidAt: true, providerEnum: true },
    }),
    db.adminSubscriptionNote.count({
      where: { subscriptionId, deletedAt: null },
    }),
    db.subscriptionPendingChange.findFirst({
      where: { subscriptionId, status: "PENDING" },
      select: { changeType: true, effectiveAt: true },
    }),
  ]);

  const paymentCount = await db.membershipPayment.count({ where: { subscriptionId } });
  const isFree = false; // plan.monthlyPrice not in select — simplified

  const subIssues = detectSubscriptionIssues({
    status: sub.status,
    planId: sub.planId,
    lockedPriceMinor: sub.lockedPriceMinor,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt,
    companyStatus: sub.company.status,
    lastPaymentStatus: lastPayment?.status ?? null,
    paymentCount,
    failedPaymentCount: sub.failedPaymentCount,
    isFree,
  });

  const companyIssues = await detectSubscriptionIssuesForCompany(sub.company.id);
  const issues = [...new Set<SubscriptionIssue>([...subIssues, ...companyIssues])];
  const issueDetails = issues.map((code) => ({
    code,
    label: getIssueLabel(code),
    tab: ISSUE_TAB_LINKS[code] ?? "overview",
  }));

  const owner = sub.company.users[0]?.user ?? null;

  return {
    id: sub.id,
    companyId: sub.company.id,
    companyName: sub.company.name,
    companyStatus: sub.company.status,
    owner,
    planId: sub.planId,
    planName: sub.plan?.name ?? null,
    planCode: sub.plan?.code ?? null,
    status: sub.status,
    billingInterval: sub.billingInterval,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    monthlyRevenue: sub.lockedPlanPrice?.monthlyEquivalentMinor ?? null,
    currency: sub.lockedPlanPrice?.currency ?? "TRY",
    lastPayment: lastPayment
      ? {
          status: lastPayment.status,
          amount: Number(lastPayment.amount),
          currency: lastPayment.currency,
          paidAt: lastPayment.paidAt?.toISOString() ?? null,
          provider: lastPayment.providerEnum ?? null,
        }
      : null,
    pendingChange: pendingChange
      ? {
          changeType: pendingChange.changeType,
          scheduledFor: pendingChange.effectiveAt?.toISOString() ?? null,
        }
      : null,
    noteCount,
    issues,
    issueDetails,
    createdAt: sub.createdAt.toISOString(),
    lastProviderSyncAt: sub.lastProviderSyncAt?.toISOString() ?? null,
    lastProviderSyncStatus: sub.lastProviderSyncStatus ?? null,
  };
}

export async function getSubscriptionOverviewTab(subscriptionId: string) {
  const sub = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      company: { select: { id: true, name: true, status: true } },
      plan: { select: { id: true, name: true, code: true, monthlyPrice: true } },
      lockedPlanPrice: {
        select: {
          currency: true,
          monthlyEquivalentMinor: true,
          salePriceMinor: true,
          listPriceMinor: true,
          billingInterval: true,
          vatRate: true,
          vatIncluded: true,
        },
      },
      pendingChanges: {
        where: { status: "PENDING" },
        select: {
          id: true,
          changeType: true,
          effectiveAt: true,
          reason: true,
          createdAt: true,
        },
        take: 1,
      },
    },
  });

  if (!sub) return null;

  // Last successful payment
  const lastSuccessPayment = sub.lastSuccessfulPaymentId
    ? await db.membershipPayment.findUnique({
        where: { id: sub.lastSuccessfulPaymentId },
        select: { amount: true, currency: true, paidAt: true, period: true },
      })
    : null;

  // Campaign/coupon on last payment
  const lastPaymentDiscount = await db.membershipPayment.findFirst({
    where: { subscriptionId },
    orderBy: { createdAt: "desc" },
    include: {
      couponRedemptions: {
        include: { coupon: { select: { code: true, name: true } } },
        take: 1,
      },
      discountRedemptions: {
        include: { campaign: { select: { code: true, name: true } } },
        take: 1,
      },
    },
  });

  const campaignInfo = lastPaymentDiscount?.discountRedemptions[0]?.campaign ?? null;
  const couponInfo = lastPaymentDiscount?.couponRedemptions[0]?.coupon ?? null;

  const [addonRows, lastPaymentProvider, paymentCount, companyIssues] = await Promise.all([
    db.companyAddOnSubscription.findMany({
      where: { subscriptionId, status: { in: ["ACTIVE", "PENDING"] } },
      include: { addOnPrice: { select: { listPriceMinor: true, currency: true } } },
    }),
    db.membershipPayment.findFirst({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
      select: { providerEnum: true, merchantOid: true },
    }),
    db.membershipPayment.count({ where: { subscriptionId } }),
    detectSubscriptionIssuesForCompany(sub.company.id),
  ]);

  const addonTotalMinor = addonRows.reduce(
    (sum, a) => sum + (a.addOnPrice?.listPriceMinor ?? 0) * a.quantity,
    0
  );
  const addonCurrency = addonRows[0]?.addOnPrice?.currency ?? sub.lockedPlanPrice?.currency ?? "TRY";

  const subIssues = detectSubscriptionIssues({
    status: sub.status,
    planId: sub.planId,
    lockedPriceMinor: sub.lockedPriceMinor,
    currentPeriodEnd: sub.currentPeriodEnd,
    trialEndsAt: sub.trialEndsAt,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt,
    companyStatus: sub.company.status,
    lastPaymentStatus: lastPaymentDiscount?.status ?? null,
    paymentCount,
    failedPaymentCount: sub.failedPaymentCount,
    isFree: sub.plan ? Number(sub.plan.monthlyPrice) === 0 : false,
  });
  const issues = [...new Set([...subIssues, ...companyIssues])].map((code) => ({
    code,
    label: getIssueLabel(code as SubscriptionIssue),
    tab: ISSUE_TAB_LINKS[code as SubscriptionIssue] ?? "overview",
  }));

  const isFree = sub.plan ? Number(sub.plan.monthlyPrice) === 0 : false;
  const pricingCurrency = sub.lockedPlanPrice?.currency ?? "TRY";
  const monthlyMinor = sub.lockedPlanPrice?.monthlyEquivalentMinor ?? null;
  const yearlyMinor = monthlyMinor != null ? monthlyMinor * 12 : null;
  const saleMinor = sub.lockedPlanPrice?.salePriceMinor ?? null;
  const estimatedNextPaymentMinor =
    saleMinor != null ? saleMinor + addonTotalMinor : null;

  return {
    subscriptionId: sub.id,
    company: sub.company,
    plan: sub.plan,
    isFree,
    status: sub.status,
    billingInterval: sub.billingInterval,
    trialStartedAt: sub.trialStartedAt?.toISOString() ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    trialExtensionReason: sub.trialExtensionReason ?? null,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    nextBillingAt: sub.nextBillingAt?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    cancellationReason: sub.cancellationReason ?? null,
    cancellationScheduledAt: sub.cancellationScheduledAt?.toISOString() ?? null,
    internalCancellationNote: sub.internalCancellationNote ?? null,
    failedPaymentCount: sub.failedPaymentCount,
    autoRenew: sub.autoRenew,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
    pricing: sub.lockedPlanPrice
      ? {
          listPriceMinor: sub.lockedPlanPrice.listPriceMinor,
          salePriceMinor: sub.lockedPlanPrice.salePriceMinor,
          monthlyEquivalentMinor: sub.lockedPlanPrice.monthlyEquivalentMinor,
          yearlyEquivalentMinor: yearlyMinor,
          currency: pricingCurrency,
          vatRate: sub.lockedPlanPrice.vatRate,
          vatIncluded: sub.lockedPlanPrice.vatIncluded,
          addonTotalMinor,
          addonCurrency,
          estimatedNextPaymentMinor,
        }
      : null,
    lastSuccessPayment: lastSuccessPayment
      ? {
          amount: Number(lastSuccessPayment.amount),
          currency: lastSuccessPayment.currency,
          paidAt: lastSuccessPayment.paidAt?.toISOString() ?? null,
        }
      : null,
    campaign: campaignInfo,
    coupon: couponInfo,
    pendingChange: sub.pendingChanges[0] ?? null,
    provider: lastPaymentProvider?.providerEnum ?? null,
    providerRef: maskProviderRef(lastPaymentProvider?.merchantOid),
    lastProviderSyncAt: sub.lastProviderSyncAt?.toISOString() ?? null,
    lastProviderSyncStatus: sub.lastProviderSyncStatus ?? null,
    issues,
    startedAt: sub.createdAt.toISOString(),
  };
}

export async function getSubscriptionPaymentsTab(
  subscriptionId: string,
  page = 1,
  pageSize = 30,
  filters?: {
    status?: string;
    provider?: string;
    dateFrom?: string;
    dateTo?: string;
    refundStatus?: string;
  }
) {
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { subscriptionId };
  if (filters?.status) where.status = filters.status;
  if (filters?.provider) where.providerEnum = filters.provider;
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }
  if (filters?.refundStatus === "refunded") {
    where.status = { in: ["REFUNDED", "PARTIALLY_REFUNDED"] };
  } else if (filters?.refundStatus === "none") {
    where.refundedAmountMinor = null;
  }

  const [total, payments] = await Promise.all([
    db.membershipPayment.count({ where }),
    db.membershipPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        merchantOid: true,
        period: true,
        periodStart: true,
        periodEnd: true,
        amount: true,
        currency: true,
        status: true,
        providerEnum: true,
        providerStatus: true,
        failedReasonCode: true,
        failedReasonMessage: true,
        refundedAmountMinor: true,
        callbackReceivedAt: true,
        paidAt: true,
        failedAt: true,
        createdAt: true,
        // Kart bilgisi, credential, ham callback body gösterilmez
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: payments.map((p) => ({
      id: p.id,
      merchantOid: maskProviderRef(p.merchantOid),
      period: p.period,
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      provider: p.providerEnum,
      providerStatus: p.providerStatus,
      failedReasonCode: p.failedReasonCode,
      failedReasonMessage: p.failedReasonMessage,
      refundedAmountMinor: p.refundedAmountMinor,
      callbackReceivedAt: p.callbackReceivedAt?.toISOString() ?? null,
      paidAt: p.paidAt?.toISOString() ?? null,
      failedAt: p.failedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function getSubscriptionHistoryTab(subscriptionId: string) {
  const [activityLogs, pendingChanges, payments] = await Promise.all([
    db.activityLog.findMany({
      where: { action: { contains: "SUBSCRIPTION" }, message: { contains: subscriptionId } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.subscriptionPendingChange.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        changeType: true,
        status: true,
        effectiveAt: true,
        reason: true,
        createdAt: true,
        appliedAt: true,
        cancelledAt: true,
      },
    }),
    db.membershipPayment.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        paidAt: true,
        failedAt: true,
        createdAt: true,
        period: true,
      },
    }),
  ]);

  // Also fetch subscription itself for creation event
  const sub = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    select: {
      createdAt: true,
      trialStartedAt: true,
      cancelledAt: true,
      cancellationReason: true,
      trialExtensionReason: true,
    },
  });

  type HistoryEvent = {
    id: string;
    type: string;
    date: string;
    label: string;
    detail: string | null;
    oldValue: string | null;
    newValue: string | null;
    source: "SYSTEM" | "ADMIN" | "USER";
    actor: string | null;
    relatedId: string | null;
  };

  const events: HistoryEvent[] = [];

  if (sub) {
    events.push({
      id: "sub-created",
      type: "CREATED",
      date: sub.createdAt.toISOString(),
      label: "Abonelik oluşturuldu",
      detail: null,
      oldValue: null,
      newValue: sub.createdAt.toISOString(),
      source: "SYSTEM",
      actor: null,
      relatedId: subscriptionId,
    });
    if (sub.trialStartedAt) {
      events.push({
        id: "trial-started",
        type: "TRIAL_STARTED",
        date: sub.trialStartedAt.toISOString(),
        label: "Trial başladı",
        detail: sub.trialExtensionReason ?? null,
        oldValue: null,
        newValue: sub.trialStartedAt.toISOString(),
        source: "SYSTEM",
        actor: null,
        relatedId: subscriptionId,
      });
    }
    if (sub.cancelledAt) {
      events.push({
        id: "sub-cancelled",
        type: "CANCELLED",
        date: sub.cancelledAt.toISOString(),
        label: "Abonelik iptal edildi",
        detail: sub.cancellationReason ?? null,
        oldValue: "ACTIVE",
        newValue: "CANCELLED",
        source: "ADMIN",
        actor: null,
        relatedId: subscriptionId,
      });
    }
  }

  for (const log of activityLogs) {
    // Payment events are already shown via the payments array — skip duplicates
    if (log.action.startsWith("PAYMENT_") || log.action === "MEMBERSHIP_PAYMENT_CREATED") continue;
    // Subscription-created events are already in the sub-created event above
    if (log.action === "SUBSCRIPTION_CREATED") continue;
    events.push({
      id: `log-${log.id}`,
      type: log.action,
      date: log.createdAt.toISOString(),
      label: log.message ?? log.action,
      detail: null,
      oldValue: null,
      newValue: null,
      source: log.userId ? "ADMIN" : "SYSTEM",
      actor: log.user?.name ?? log.user?.email ?? null,
      relatedId: log.id,
    });
  }

  for (const change of pendingChanges) {
    events.push({
      id: `change-${change.id}`,
      type: `PENDING_CHANGE_${change.status}`,
      date: (change.appliedAt ?? change.cancelledAt ?? change.createdAt).toISOString(),
      label: `Bekleyen değişiklik: ${change.changeType} (${change.status})`,
      detail: change.reason ?? null,
      oldValue: change.status,
      newValue: change.changeType,
      source: "ADMIN",
      actor: null,
      relatedId: change.id,
    });
  }

  for (const payment of payments) {
    events.push({
      id: `payment-${payment.id}`,
      type: payment.status === "PAID" ? "PAYMENT_SUCCESS" : `PAYMENT_${payment.status}`,
      date: (payment.paidAt ?? payment.failedAt ?? payment.createdAt).toISOString(),
      label:
        payment.status === "PAID"
          ? `Ödeme alındı: ${Number(payment.amount)} ${payment.currency}`
          : `Ödeme ${payment.status}: ${Number(payment.amount)} ${payment.currency}`,
      detail: null,
      oldValue: null,
      newValue: payment.status,
      source: "SYSTEM",
      actor: null,
      relatedId: payment.id,
    });
  }

  // Deduplicate by id, sort by date desc
  const seen = new Set<string>();
  const deduped = events
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return deduped;
}

export async function getSubscriptionAddonsTab(subscriptionId: string) {
  const addons = await db.companyAddOnSubscription.findMany({
    where: { subscriptionId },
    include: {
      addOn: { select: { id: true, name: true, code: true, entitlementCode: true, type: true } },
      addOnPrice: { select: { currency: true, listPriceMinor: true, billingInterval: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return addons.map((a) => ({
    id: a.id,
    addOnId: a.addOnId,
    name: a.addOn.name,
    code: a.addOn.code,
    type: a.addOn.type,
    entitlementCode: a.addOn.entitlementCode,
    quantity: a.quantity,
    status: a.status,
    billingInterval: a.billingInterval,
    currentPeriodStart: a.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: a.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: a.cancelAtPeriodEnd,
    cancelledAt: a.cancelledAt?.toISOString() ?? null,
    autoRenew: a.autoRenew,
    pricePerUnit: a.addOnPrice?.listPriceMinor ?? null,
    currency: a.addOnPrice?.currency ?? "TRY",
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function getSubscriptionActivityTab(
  subscriptionId: string,
  companyId: string,
  page = 1,
  pageSize = 30,
  filters?: {
    action?: string;
    source?: string;
    success?: "success" | "error";
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {
    companyId,
    module: "admin-subscriptions",
  };
  if (filters?.action) where.action = { contains: filters.action };
  if (filters?.dateFrom || filters?.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
    };
  }
  if (filters?.success === "success") {
    where.action = { not: { contains: "FAILED" } };
  } else if (filters?.success === "error") {
    where.action = { contains: "FAILED" };
  }

  const [total, logs] = await Promise.all([
    db.activityLog.count({ where }),
    db.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      module: log.module,
      message: log.message ?? "",
      user: log.user,
      source: log.userId ? "ADMIN" : "SYSTEM",
      success: !log.action.includes("FAILED"),
      ip: log.ip ? maskIp(log.ip) : null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return "—";
}
