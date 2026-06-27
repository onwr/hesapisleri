import "server-only";

import type {
  BillingOutboxEventType,
  MembershipPeriod,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { nextBillingDate, resolvePaidPeriod } from "@/lib/billing/billing-period-utils";
import {
  resolveSubscriptionPrice,
} from "@/lib/billing/price-resolution-service";
import { formatMinorToMoney } from "@/lib/billing/pricing-utils";
import {
  ADMIN_SUBSCRIPTION_PAGE_SIZE,
  mapResolvedPriceSource,
  MAX_TRIAL_EXTENSION_DAYS,
  type AdminSubscriptionListFilters,
} from "@/lib/admin-subscription-utils";
import { resolveSubscriptionPricesBulk } from "@/lib/billing/resolve-subscription-prices-bulk";
import { isBillingProrationEnabled } from "@/lib/billing/billing-feature-flags";
import {
  cancelPendingChange,
  getActivePendingChange,
  schedulePendingChange,
} from "@/lib/billing/subscription-pending-change-service";
import { syncLegacyMembershipSettings } from "@/lib/billing/subscription-legacy-sync";
import { resolveCompanyEntitlements } from "@/lib/billing/entitlements/entitlement-resolution-service";
import { getEntitlementMeta } from "@/lib/billing/entitlements/entitlement-registry";
import { assertSubscriptionTransition } from "@/lib/payments/payment-state-machine";
import { ensureCompanySubscription, getDefaultMembershipPlan } from "@/lib/membership-service";

export class AdminSubscriptionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminSubscriptionError";
    this.status = status;
  }
}

const subscriptionInclude = {
  company: {
    include: {
      settings: true,
      users: {
        where: { isOwner: true },
        take: 1,
        include: { user: true },
      },
      partnerConversions: {
        take: 1,
        orderBy: { createdAt: "desc" },
        include: {
          partner: true,
        },
      },
    },
  },
  plan: true,
  defaultPaymentMethod: true,
  lockedPlanPrice: true,
  nextPlanPrice: true,
} satisfies Prisma.CompanySubscriptionInclude;

type SubscriptionRow = Prisma.CompanySubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

async function syncSubscriptionLegacy(
  companyId: string,
  subscription: {
    status: SubscriptionStatus;
    nextBillingAt?: Date | null;
    currentPeriodEnd?: Date | null;
    planId?: string | null;
  },
  extra?: { lastPaymentDate?: Date | null; monthlyFeeMinor?: number | null }
) {
  await syncLegacyMembershipSettings(companyId, {
    subscription,
    ...extra,
  });
}

async function getSubscriptionUsageCounts(companyId: string) {
  const [users, warehouses, products, marketplaceIntegrations] = await Promise.all([
    db.companyUser.count({ where: { companyId } }),
    db.warehouse.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.marketplaceIntegration.count({ where: { companyId } }),
  ]);
  return { users, warehouses, products, marketplaceIntegrations };
}

async function logSubscriptionAdminAction(input: {
  actorUserId: string;
  companyId: string;
  subscriptionId: string;
  action: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
}) {
  const payload = {
    subscriptionId: input.subscriptionId,
    reason: input.reason ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    requestId: input.requestId ?? null,
  };

  await db.activityLog.create({
    data: {
      userId: input.actorUserId,
      companyId: input.companyId,
      action: input.action,
      module: "admin-subscriptions",
      message: JSON.stringify(payload),
    },
  });
}

async function enqueueAdminSubscriptionOutbox(input: {
  companyId: string;
  subscriptionId: string;
  type: BillingOutboxEventType;
  payload: Prisma.InputJsonValue;
}) {
  await enqueueBillingOutboxEvent({
    companyId: input.companyId,
    type: input.type,
    aggregateType: "CompanySubscription",
    aggregateId: input.subscriptionId,
    payload: input.payload,
  });
}

async function loadSubscriptionOrThrow(subscriptionId: string) {
  const subscription = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    include: subscriptionInclude,
  });

  if (!subscription) {
    throw new AdminSubscriptionError("Abonelik bulunamadı.", 404);
  }

  return subscription;
}

async function assertNoProcessingBillingRun(subscriptionId: string) {
  const processing = await db.subscriptionBillingRun.findFirst({
    where: {
      subscriptionId,
      status: "PROCESSING",
    },
  });

  if (processing) {
    throw new AdminSubscriptionError(
      "Devam eden faturalandırma işlemi var. Lütfen tamamlanmasını bekleyin.",
      409
    );
  }
}

async function assertVersion(
  subscriptionId: string,
  expectedUpdatedAt?: string | null
) {
  if (!expectedUpdatedAt) return;
  const current = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
    select: { updatedAt: true },
  });
  if (!current) {
    throw new AdminSubscriptionError("Abonelik bulunamadı.", 404);
  }
  if (current.updatedAt.toISOString() !== expectedUpdatedAt) {
    throw new AdminSubscriptionError(
      "Abonelik başka bir işlemle güncellendi. Sayfayı yenileyip tekrar deneyin.",
      409
    );
  }
}

function ownerFromSubscription(subscription: SubscriptionRow) {
  const owner = subscription.company.users[0]?.user;
  return {
    name: owner?.name ?? "—",
    email: owner?.email ?? subscription.company.email ?? "—",
  };
}

async function resolvePricesForSubscription(subscription: SubscriptionRow) {
  if (!subscription.planId || !subscription.billingInterval) {
    return null;
  }

  try {
    const paid = await resolveSubscriptionPrice({
      companyId: subscription.companyId,
      planId: subscription.planId,
      billingInterval: subscription.billingInterval,
      isRenewal: false,
    });
    const renewal = await resolveSubscriptionPrice({
      companyId: subscription.companyId,
      planId: subscription.planId,
      billingInterval: subscription.billingInterval,
      isRenewal: true,
    });
    return { paid, renewal };
  } catch {
    return null;
  }
}

function buildListWhere(
  filters: AdminSubscriptionListFilters
): Prisma.CompanySubscriptionWhereInput {
  const where: Prisma.CompanySubscriptionWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.planId) where.planId = filters.planId;
  if (filters.interval) where.billingInterval = filters.interval;
  if (filters.autoRenew === "true") where.autoRenew = true;
  if (filters.autoRenew === "false") where.autoRenew = false;
  if (filters.trial === "true") where.status = "TRIAL";
  if (filters.grace === "true") {
    where.OR = [{ status: "GRACE_PERIOD" }, { graceEndsAt: { not: null } }];
  }
  if (filters.hasPaymentMethod === "true") {
    where.defaultPaymentMethodId = { not: null };
  }
  if (filters.hasPaymentMethod === "false") {
    where.defaultPaymentMethodId = null;
  }

  if (filters.nextBillingFrom || filters.nextBillingTo) {
    where.nextBillingAt = {};
    if (filters.nextBillingFrom) {
      where.nextBillingAt.gte = new Date(filters.nextBillingFrom);
    }
    if (filters.nextBillingTo) {
      where.nextBillingAt.lte = new Date(filters.nextBillingTo);
    }
  }

  if (filters.periodStartFrom || filters.periodStartTo) {
    where.currentPeriodStart = {};
    if (filters.periodStartFrom) {
      where.currentPeriodStart.gte = new Date(filters.periodStartFrom);
    }
    if (filters.periodStartTo) {
      where.currentPeriodStart.lte = new Date(filters.periodStartTo);
    }
  }

  if (filters.periodEndFrom || filters.periodEndTo) {
    where.currentPeriodEnd = {};
    if (filters.periodEndFrom) {
      where.currentPeriodEnd.gte = new Date(filters.periodEndFrom);
    }
    if (filters.periodEndTo) {
      where.currentPeriodEnd.lte = new Date(filters.periodEndTo);
    }
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { company: { name: { contains: q, mode: "insensitive" } } },
      { company: { email: { contains: q, mode: "insensitive" } } },
      { plan: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.partnerId) {
    where.company = {
      partnerConversions: { some: { partnerId: filters.partnerId } },
    };
  }

  if (filters.partnerScope === "WITH") {
    where.company = {
      ...((where.company as object) ?? {}),
      partnerConversions: { some: {} },
    };
  } else if (filters.partnerScope === "WITHOUT") {
    where.company = {
      ...((where.company as object) ?? {}),
      partnerConversions: { none: {} },
    };
  }

  return where;
}

function listOrderBy(
  filters: AdminSubscriptionListFilters
): Prisma.CompanySubscriptionOrderByWithRelationInput {
  const direction = filters.order === "desc" ? "desc" : "asc";
  switch (filters.sort) {
    case "periodEnd":
      return { currentPeriodEnd: direction };
    case "created":
      return { createdAt: direction };
    case "company":
      return { company: { name: direction } };
    case "nextBilling":
    default:
      return { nextBillingAt: direction };
  }
}

export async function getAdminSubscriptionsSummary() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    total,
    active,
    trial,
    pastDue,
    gracePeriod,
    renewingThisMonth,
    suspended,
    cancelAtPeriodEnd,
    autoRenewOn,
    missingPaymentMethod,
  ] = await Promise.all([
    db.companySubscription.count(),
    db.companySubscription.count({ where: { status: "ACTIVE" } }),
    db.companySubscription.count({ where: { status: "TRIAL" } }),
    db.companySubscription.count({ where: { status: "PAST_DUE" } }),
    db.companySubscription.count({ where: { status: "GRACE_PERIOD" } }),
    db.companySubscription.count({
      where: {
        nextBillingAt: { gte: monthStart, lte: monthEnd },
        status: { in: ["ACTIVE", "PAST_DUE", "GRACE_PERIOD"] },
      },
    }),
    db.companySubscription.count({ where: { status: "SUSPENDED" } }),
    db.companySubscription.count({ where: { status: "CANCEL_AT_PERIOD_END" } }),
    db.companySubscription.count({ where: { autoRenew: true } }),
    db.companySubscription.count({
      where: { autoRenew: true, defaultPaymentMethodId: null },
    }),
  ]);

  return {
    total,
    active,
    trial,
    pastDue,
    gracePeriod,
    renewingThisMonth,
    suspended,
    cancelAtPeriodEnd,
    autoRenewOn,
    missingPaymentMethod,
  };
}

export async function listAdminSubscriptions(filters: AdminSubscriptionListFilters) {
  const page = filters.page ?? 1;
  const where = buildListWhere(filters);

  const [total, rows, lastPayments] = await Promise.all([
    db.companySubscription.count({ where }),
    db.companySubscription.findMany({
      where,
      include: subscriptionInclude,
      orderBy: listOrderBy(filters),
      skip: (page - 1) * ADMIN_SUBSCRIPTION_PAGE_SIZE,
      take: ADMIN_SUBSCRIPTION_PAGE_SIZE,
    }),
    db.companySubscription.findMany({
      where,
      select: { lastSuccessfulPaymentId: true },
    }),
  ]);

  const paymentIds = lastPayments
    .map((r) => r.lastSuccessfulPaymentId)
    .filter((id): id is string => Boolean(id));

  const payments = paymentIds.length
    ? await db.membershipPayment.findMany({
        where: { id: { in: paymentIds } },
        select: {
          id: true,
          amountMinor: true,
          amount: true,
          priceSnapshot: true,
        },
      })
    : [];

  const paymentMap = new Map(payments.map((p) => [p.id, p]));

  const items = await (async () => {
    const bulkInputs = rows
      .filter((s) => s.planId && s.billingInterval)
      .map((s) => ({
        key: s.id,
        companyId: s.companyId,
        planId: s.planId!,
        billingInterval: s.billingInterval!,
      }));

    const priceMap = await resolveSubscriptionPricesBulk(bulkInputs);

    return Promise.all(
      rows.map(async (subscription) => {
      const owner = ownerFromSubscription(subscription);
      const bulkPrices = subscription.planId && subscription.billingInterval
        ? priceMap.get(subscription.id)
        : null;
      const prices = bulkPrices
        ? { paid: bulkPrices.paid!, renewal: bulkPrices.renewal! }
        : await resolvePricesForSubscription(subscription);
      const lastPayment = subscription.lastSuccessfulPaymentId
        ? paymentMap.get(subscription.lastSuccessfulPaymentId)
        : null;

      const paidAmountMinor =
        lastPayment?.amountMinor ??
        (lastPayment?.amount ? Math.round(Number(lastPayment.amount) * 100) : null);

      const priceSource = prices
        ? mapResolvedPriceSource(
            prices.renewal.priceSource,
            prices.renewal.appliedDiscounts
          )
        : { label: "UNKNOWN" as const, description: "—" };

      return {
        id: subscription.id,
        companyId: subscription.companyId,
        companyName: subscription.company.name,
        companyStatus: subscription.company.status,
        ownerEmail: owner.email,
        planId: subscription.planId,
        planName: subscription.plan?.name ?? "—",
        planVersion: prices?.renewal.priceVersion ?? null,
        billingInterval: subscription.billingInterval,
        status: subscription.status,
        paidPriceMinor: paidAmountMinor,
        paidPriceFormatted:
          paidAmountMinor != null ? formatMinorToMoney(paidAmountMinor) : "—",
        renewalPriceMinor: prices?.renewal.totalMinor ?? null,
        renewalPriceFormatted: prices
          ? formatMinorToMoney(prices.renewal.totalMinor)
          : "—",
        priceSource: priceSource.label,
        priceSourceDescription: priceSource.description,
        isGrandfathered: subscription.priceLockType === "GRANDFATHERED",
        autoRenew: subscription.autoRenew,
        currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        nextBillingAt: subscription.nextBillingAt?.toISOString() ?? null,
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
        graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
        hasPaymentMethod: Boolean(subscription.defaultPaymentMethodId),
        updatedAt: subscription.updatedAt.toISOString(),
      };
    })
    );
  })();

  const filteredItems = filters.priceSource
    ? items.filter((item) => item.priceSource === filters.priceSource)
    : items;

  return {
    items: filteredItems,
    pagination: {
      page,
      pageSize: ADMIN_SUBSCRIPTION_PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / ADMIN_SUBSCRIPTION_PAGE_SIZE)),
    },
  };
}

export async function getAdminSubscriptionDetail(subscriptionId: string) {
  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  const owner = ownerFromSubscription(subscription);
  const prices = await resolvePricesForSubscription(subscription);

  const [payments, overrides, entitlements, history, auditLogs, billingRuns, pendingChange, usage, resolvedEntitlements, companyOverrides, addOnSubs] =
    await Promise.all([
      db.membershipPayment.findMany({
        where: { companyId: subscription.companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.companyPlanPriceOverride.findMany({
        where: { companyId: subscription.companyId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      subscription.planId
        ? db.planEntitlement.findMany({
            where: { planId: subscription.planId },
            orderBy: { sortOrder: "asc" },
          })
        : Promise.resolve([]),
      db.activityLog.findMany({
        where: {
          companyId: subscription.companyId,
          module: "admin-subscriptions",
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.activityLog.findMany({
        where: { companyId: subscription.companyId, module: "admin" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { name: true, email: true } } },
      }),
      db.subscriptionBillingRun.findMany({
        where: { subscriptionId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      getActivePendingChange(subscriptionId),
      getSubscriptionUsageCounts(subscription.companyId),
      resolveCompanyEntitlements(subscription.companyId),
      db.companyEntitlementOverride.findMany({
        where: { companyId: subscription.companyId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      }),
      db.companyAddOnSubscription.findMany({
        where: {
          companyId: subscription.companyId,
          status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] },
        },
        include: { addOn: true },
      }),
    ]);

  const pendingTargetPlan = pendingChange?.targetPlanId
    ? await db.membershipPlan.findUnique({
        where: { id: pendingChange.targetPlanId },
        select: { id: true, name: true, code: true },
      })
    : null;

  const pendingRequestedBy = pendingChange?.requestedByUserId
    ? await db.user.findUnique({
        where: { id: pendingChange.requestedByUserId },
        select: { id: true, name: true, email: true },
      })
    : null;

  const lastSuccess = payments.find((p) => p.status === "PAID");
  const lastFailed = payments.find((p) => p.status === "FAILED");

  const priceSource = prices
    ? mapResolvedPriceSource(prices.renewal.priceSource, prices.renewal.appliedDiscounts)
    : { label: "UNKNOWN" as const, description: "—" };

  return {
    subscription: {
      id: subscription.id,
      companyId: subscription.companyId,
      status: subscription.status,
      trialStartedAt: subscription.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      nextBillingAt: subscription.nextBillingAt?.toISOString() ?? null,
      graceEndsAt: subscription.graceEndsAt?.toISOString() ?? null,
      autoRenew: subscription.autoRenew,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
      cancellationReason: subscription.cancellationReason,
      failedPaymentCount: subscription.failedPaymentCount,
      billingInterval: subscription.billingInterval,
      priceLockedUntil: subscription.priceLockedUntil?.toISOString() ?? null,
      priceLockType: subscription.priceLockType,
      lockedPriceMinor: subscription.lockedPriceMinor,
      lockedListPriceMinor: subscription.lockedListPriceMinor,
      nextPriceEffectiveAt: subscription.nextPriceEffectiveAt?.toISOString() ?? null,
      updatedAt: subscription.updatedAt.toISOString(),
    },
    company: {
      id: subscription.company.id,
      name: subscription.company.name,
      email: subscription.company.email,
      status: subscription.company.status,
      ownerName: owner.name,
      ownerEmail: owner.email,
    },
    plan: subscription.plan
      ? {
          id: subscription.plan.id,
          name: subscription.plan.name,
          code: subscription.plan.code,
        }
      : null,
    pricing: prices
      ? {
          paid: prices.paid,
          renewal: prices.renewal,
          priceSource: priceSource.label,
          priceSourceDescription: priceSource.description,
        }
      : null,
    paymentMethod: subscription.defaultPaymentMethod
      ? {
          id: subscription.defaultPaymentMethod.id,
          brand: subscription.defaultPaymentMethod.cardBrand,
          last4: subscription.defaultPaymentMethod.lastFour,
          status: subscription.defaultPaymentMethod.status,
        }
      : null,
    partner: subscription.company.partnerConversions[0]?.partner
      ? {
          id: subscription.company.partnerConversions[0].partnerId,
          name: subscription.company.partnerConversions[0].partner.fullName,
          code: subscription.company.partnerConversions[0].partner.referralCode,
        }
      : null,
    lastSuccessfulPayment: lastSuccess
      ? {
          id: lastSuccess.id,
          amountMinor: lastSuccess.amountMinor,
          paidAt: lastSuccess.paidAt?.toISOString() ?? null,
        }
      : null,
    lastFailedPayment: lastFailed
      ? {
          id: lastFailed.id,
          amountMinor: lastFailed.amountMinor,
          failedAt: lastFailed.failedAt?.toISOString() ?? null,
          reason: lastFailed.failedReasonMessage,
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      merchantOid: p.merchantOid,
      type: p.type,
      period: p.period,
      amountMinor: p.amountMinor,
      status: p.status,
      provider: p.providerEnum ?? p.provider,
      testMode: p.testMode,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      refundedAmountMinor: p.refundedAmountMinor,
      adminUrl: `/admin/payments?q=${encodeURIComponent(p.merchantOid ?? p.id)}`,
      isReconciled: p.status === "PAID" && Boolean(p.paidAt),
    })),
    overrides,
    entitlements,
    history: history.map((log) => ({
      id: log.id,
      action: log.action,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
      actorName: log.user?.name ?? "Sistem",
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      message: log.message,
      createdAt: log.createdAt.toISOString(),
      actorName: log.user?.name ?? "Sistem",
    })),
    billingRuns,
    pendingChange: pendingChange
      ? {
          id: pendingChange.id,
          changeType: pendingChange.changeType,
          status: pendingChange.status,
          currentPlanName: subscription.plan?.name ?? "—",
          targetPlanName: pendingTargetPlan?.name ?? subscription.plan?.name ?? "—",
          currentInterval: subscription.billingInterval,
          targetInterval:
            pendingChange.targetBillingInterval ?? subscription.billingInterval,
          effectiveAt: pendingChange.effectiveAt.toISOString(),
          estimatedPriceMinor: pendingChange.estimatedPriceMinor,
          reason: pendingChange.reason,
          requestedBy: pendingRequestedBy
            ? { name: pendingRequestedBy.name, email: pendingRequestedBy.email }
            : null,
        }
      : null,
    usage: {
      users: usage.users,
      warehouses: usage.warehouses,
      products: usage.products,
      marketplaceIntegrations: usage.marketplaceIntegrations,
      ocr: null,
      eDocument: null,
      storage: null,
    },
    resolvedEntitlements: Object.values(resolvedEntitlements.entitlements)
      .filter((e) => e.kind === "LIMIT")
      .map((e) => {
        if (e.kind !== "LIMIT") return null;
        const meta = getEntitlementMeta(e.code);
        return {
          code: e.code,
          label: meta?.label ?? e.code,
          value: e.value,
          isUnlimited: e.isUnlimited,
          usage: e.usage,
          remaining: e.remaining,
          overBy: e.overBy,
          isOverLimit: e.isOverLimit,
          canCreate: e.canCreate,
          source: e.source,
          breakdown: e.breakdown,
          resetsAt: e.resetsAt,
        };
      })
      .filter(Boolean),
    companyOverrides,
    addOnSubscriptions: addOnSubs.map((s) => ({
      id: s.id,
      name: s.addOn.name,
      quantity: s.quantity,
      status: s.status,
      entitlementCode: s.addOn.entitlementCode,
    })),
  };
}

const reasonSchema = z.string().min(3, "Sebep en az 3 karakter olmalıdır.");

export const extendTrialSchema = z.object({
  mode: z.enum(["PLUS_3", "PLUS_7", "PLUS_14", "CUSTOM"]),
  customDate: z.string().datetime().optional(),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function extendSubscriptionTrial(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof extendTrialSchema>
) {
  const parsed = extendTrialSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  if (subscription.status !== "TRIAL") {
    throw new AdminSubscriptionError("Yalnızca deneme aboneliklerinde trial uzatılabilir.");
  }

  const now = new Date();
  const base = subscription.trialEndsAt ?? now;
  let nextEnd: Date;

  if (parsed.mode === "PLUS_3") nextEnd = addDays(base, 3);
  else if (parsed.mode === "PLUS_7") nextEnd = addDays(base, 7);
  else if (parsed.mode === "PLUS_14") nextEnd = addDays(base, 14);
  else {
    if (!parsed.customDate) {
      throw new AdminSubscriptionError("Özel tarih seçilmelidir.");
    }
    nextEnd = new Date(parsed.customDate);
  }

  if (nextEnd < now) {
    throw new AdminSubscriptionError("Trial bitiş tarihi geçmişe alınamaz.");
  }

  const maxEnd = addDays(now, MAX_TRIAL_EXTENSION_DAYS);
  if (nextEnd > maxEnd) {
    throw new AdminSubscriptionError(
      `Trial en fazla ${MAX_TRIAL_EXTENSION_DAYS} gün uzatılabilir.`
    );
  }

  const before = { trialEndsAt: subscription.trialEndsAt };
  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: {
      trialEndsAt: nextEnd,
      currentPeriodEnd: nextEnd,
    },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "TRIAL_EXTENDED",
    reason: parsed.reason,
    before,
    after: { trialEndsAt: updated.trialEndsAt },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_TRIAL_EXTENDED",
    payload: { trialEndsAt: nextEnd.toISOString() },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const extendGraceSchema = z.object({
  extraDays: z.number().int().min(1).max(30).optional(),
  customEndDate: z.string().datetime().optional(),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function extendSubscriptionGrace(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof extendGraceSchema>
) {
  const parsed = extendGraceSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  if (!["PAST_DUE", "GRACE_PERIOD"].includes(subscription.status)) {
    throw new AdminSubscriptionError(
      "Grace uzatma yalnızca ödeme gecikmiş veya ek süre durumunda uygulanabilir."
    );
  }

  const base = subscription.graceEndsAt ?? new Date();
  const nextEnd = parsed.customEndDate
    ? new Date(parsed.customEndDate)
    : addDays(base, parsed.extraDays ?? 7);

  const before = { graceEndsAt: subscription.graceEndsAt, status: subscription.status };
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.companySubscription.update({
      where: { id: subscriptionId },
      data: {
        graceEndsAt: nextEnd,
        status: "GRACE_PERIOD",
      },
    });
    return row;
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "GRACE_EXTENDED",
    reason: parsed.reason,
    before,
    after: { graceEndsAt: updated.graceEndsAt, status: updated.status },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_GRACE_EXTENDED",
    payload: { graceEndsAt: nextEnd.toISOString() },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const changePlanSchema = z.object({
  targetPlanId: z.string().min(1),
  applyMode: z.enum(["IMMEDIATE", "AT_PERIOD_END"]),
  adminNote: z.string().optional(),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function changeSubscriptionPlan(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof changePlanSchema>
) {
  const parsed = changePlanSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  const interval = subscription.billingInterval ?? "MONTHLY";
  const targetPlan = await db.membershipPlan.findUnique({
    where: { id: parsed.targetPlanId },
  });
  if (!targetPlan?.isActive) {
    throw new AdminSubscriptionError("Hedef plan bulunamadı veya aktif değil.");
  }

  if (parsed.applyMode === "IMMEDIATE") {
    if (!isBillingProrationEnabled()) {
      throw new AdminSubscriptionError(
        "Hemen uygulanan plan değişikliği proration kapalıyken desteklenmiyor. Dönem sonu seçin veya ücretsiz admin override kullanın.",
        409
      );
    }
    throw new AdminSubscriptionError(
      "Proration açık olsa bile hemen plan değişikliği bu fazda henüz desteklenmiyor. Dönem sonu veya ücretsiz override kullanın.",
      409
    );
  }

  if (!subscription.currentPeriodEnd) {
    throw new AdminSubscriptionError("Dönem bitiş tarihi olmadan planlama yapılamaz.");
  }

  const before = { planId: subscription.planId };
  const change = await schedulePendingChange({
    subscriptionId,
    companyId: subscription.companyId,
    changeType: "PLAN",
    targetPlanId: parsed.targetPlanId,
    targetBillingInterval: interval,
    effectiveAt: subscription.currentPeriodEnd,
    requestedByUserId: actorUserId,
    reason: parsed.reason,
  });

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "PLAN_CHANGE_SCHEDULED",
    reason: parsed.reason,
    before,
    after: { pendingChangeId: change.id, targetPlanId: parsed.targetPlanId },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const complimentaryPlanChangeSchema = z.object({
  targetPlanId: z.string().min(1),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function complimentarySubscriptionPlanChange(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof complimentaryPlanChangeSchema>
) {
  const parsed = complimentaryPlanChangeSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  const before = { planId: subscription.planId };
  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: { planId: parsed.targetPlanId },
  });

  await syncLegacyMembershipSettings(subscription.companyId, {
    subscription: updated,
  });

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "COMPLIMENTARY_PLAN_CHANGE",
    reason: parsed.reason,
    before,
    after: { planId: parsed.targetPlanId },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_PLAN_CHANGED",
    payload: { complimentary: true },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const changeIntervalSchema = z.object({
  targetInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  applyMode: z.enum(["IMMEDIATE", "AT_PERIOD_END"]),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function changeSubscriptionInterval(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof changeIntervalSchema>
) {
  const parsed = changeIntervalSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  if (!subscription.planId) {
    throw new AdminSubscriptionError("Plan atanmamış abonelikte dönem değiştirilemez.");
  }

  if (parsed.applyMode === "IMMEDIATE") {
    throw new AdminSubscriptionError(
      "Hemen uygulanan dönem değişikliği desteklenmiyor. Dönem sonu seçin.",
      409
    );
  }

  if (!subscription.currentPeriodEnd) {
    throw new AdminSubscriptionError("Dönem bitiş tarihi olmadan planlama yapılamaz.");
  }

  const before = { billingInterval: subscription.billingInterval };
  const change = await schedulePendingChange({
    subscriptionId,
    companyId: subscription.companyId,
    changeType: "INTERVAL",
    targetPlanId: subscription.planId,
    targetBillingInterval: parsed.targetInterval,
    effectiveAt: subscription.currentPeriodEnd,
    requestedByUserId: actorUserId,
    reason: parsed.reason,
  });

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "INTERVAL_CHANGE_SCHEDULED",
    reason: parsed.reason,
    before,
    after: {
      pendingChangeId: change.id,
      targetInterval: parsed.targetInterval,
    },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export async function cancelSubscriptionPendingChange(
  subscriptionId: string,
  actorUserId: string,
  input: { reason?: string; expectedUpdatedAt?: string }
) {
  await assertVersion(subscriptionId, input.expectedUpdatedAt);
  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  const cancelled = await cancelPendingChange({
    subscriptionId,
    companyId: subscription.companyId,
    actorUserId,
    reason: input.reason,
  }).catch((error) => {
    throw new AdminSubscriptionError(
      error instanceof Error ? error.message : "Bekleyen değişiklik iptal edilemedi.",
      409
    );
  });

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "PENDING_CHANGE_CANCELLED",
    reason: input.reason,
    before: { pendingChangeId: cancelled.id },
    after: { status: "CANCELLED" },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const specialPriceSchema = z.object({
  planId: z.string().min(1),
  billingInterval: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "YEARLY"]),
  priceMinor: z.number().int().min(0),
  vatRate: z.number().min(0).max(100).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function createCompanyPriceOverride(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof specialPriceSchema>
) {
  const parsed = specialPriceSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  const override = await db.companyPlanPriceOverride.create({
    data: {
      companyId: subscription.companyId,
      planId: parsed.planId,
      billingInterval: parsed.billingInterval,
      priceMinor: parsed.priceMinor,
      vatRate: parsed.vatRate,
      startsAt: parsed.startsAt ? new Date(parsed.startsAt) : new Date(),
      endsAt: parsed.endsAt ? new Date(parsed.endsAt) : null,
      reason: parsed.reason,
      createdByUserId: actorUserId,
      status: "ACTIVE",
    },
  });

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "SPECIAL_PRICE_CREATED",
    reason: parsed.reason,
    before: null,
    after: override,
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_SPECIAL_PRICE_CREATED",
    payload: { overrideId: override.id },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const autoRenewSchema = z.object({
  enabled: z.boolean(),
  reason: reasonSchema.optional(),
  expectedUpdatedAt: z.string().optional(),
});

export async function updateSubscriptionAutoRenew(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof autoRenewSchema>
) {
  const parsed = autoRenewSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  if (parsed.enabled) {
    if (!subscription.defaultPaymentMethodId) {
      throw new AdminSubscriptionError(
        "Auto-renew açmak için aktif ödeme yöntemi gerekir."
      );
    }
    if (["CANCELLED", "EXPIRED"].includes(subscription.status)) {
      throw new AdminSubscriptionError("İptal veya süresi dolmuş abonelikte auto-renew açılamaz.");
    }
  }

  const before = { autoRenew: subscription.autoRenew };
  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: {
      autoRenew: parsed.enabled,
      nextBillingAt:
        parsed.enabled && subscription.currentPeriodEnd
          ? subscription.currentPeriodEnd
          : subscription.nextBillingAt,
    },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "AUTO_RENEW_CHANGED",
    reason: parsed.reason,
    before,
    after: { autoRenew: updated.autoRenew },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: parsed.enabled
      ? "SUBSCRIPTION_AUTO_RENEW_ENABLED"
      : "SUBSCRIPTION_AUTO_RENEW_DISABLED",
    payload: { autoRenew: updated.autoRenew },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const cancelSchema = z.object({
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function cancelSubscriptionAtPeriodEnd(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof cancelSchema>
) {
  const parsed = cancelSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  assertSubscriptionTransition(subscription.status, "CANCEL_AT_PERIOD_END");

  const before = {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };

  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "CANCEL_AT_PERIOD_END",
      cancelAtPeriodEnd: true,
      autoRenew: false,
      cancellationReason: parsed.reason,
    },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "CANCEL_AT_PERIOD_END",
    reason: parsed.reason,
    before,
    after: updated,
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_CANCEL_SCHEDULED",
    payload: { reason: parsed.reason },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export async function reactivateSubscription(
  subscriptionId: string,
  actorUserId: string,
  input: { reason?: string; expectedUpdatedAt?: string }
) {
  await assertVersion(subscriptionId, input.expectedUpdatedAt);
  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  if (!["CANCEL_AT_PERIOD_END", "CANCELLED"].includes(subscription.status)) {
    throw new AdminSubscriptionError("Bu abonelik için iptal geri alma uygun değil.");
  }

  const targetStatus: SubscriptionStatus =
    subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
      ? "ACTIVE"
      : "TRIAL";

  assertSubscriptionTransition(subscription.status, targetStatus);

  const before = {
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };

  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: {
      status: targetStatus,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      cancellationReason: null,
    },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "REACTIVATED",
    reason: input.reason,
    before,
    after: updated,
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_CANCEL_REVOKED",
    payload: { reactivatedStatus: targetStatus },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const suspendSchema = z.object({
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function suspendSubscription(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof suspendSchema>
) {
  const parsed = suspendSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  assertSubscriptionTransition(subscription.status, "SUSPENDED");

  const before = { status: subscription.status };
  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "SUSPENDED",
      autoRenew: false,
      cancellationReason: parsed.reason,
    },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "SUSPENDED",
    reason: parsed.reason,
    before,
    after: updated,
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_SUSPENDED",
    payload: { action: "ADMIN_SUSPENDED", reason: parsed.reason },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export async function activateSubscription(
  subscriptionId: string,
  actorUserId: string,
  input: { reason?: string; expectedUpdatedAt?: string }
) {
  await assertVersion(subscriptionId, input.expectedUpdatedAt);
  const subscription = await loadSubscriptionOrThrow(subscriptionId);

  if (subscription.status !== "SUSPENDED") {
    throw new AdminSubscriptionError("Yalnızca askıdaki abonelikler aktifleştirilebilir.");
  }

  assertSubscriptionTransition(subscription.status, "ACTIVE");

  const before = { status: subscription.status };
  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data: { status: "ACTIVE" },
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: "ACTIVATED",
    reason: input.reason,
    before,
    after: updated,
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_ACTIVATED",
    payload: { action: "ADMIN_ACTIVATED" },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export const manualExtensionSchema = z.discriminatedUnion("extensionType", [
  z.object({
    extensionType: z.literal("COMPLIMENTARY"),
    mode: z.enum(["MONTH_1", "MONTH_3", "MONTH_6", "MONTH_12", "CUSTOM_DAYS"]),
    customDays: z.number().int().min(1).max(730).optional(),
    reason: reasonSchema,
    expectedUpdatedAt: z.string().optional(),
  }),
  z.object({
    extensionType: z.literal("MANUAL_PAYMENT"),
    mode: z.enum(["MONTH_1", "MONTH_3", "MONTH_6", "MONTH_12", "CUSTOM_DAYS"]),
    customDays: z.number().int().min(1).max(730).optional(),
    amountMinor: z.number().int().positive(),
    paymentNote: z.string().min(3).optional(),
    reason: reasonSchema,
    expectedUpdatedAt: z.string().optional(),
  }),
]);

export async function manuallyExtendSubscription(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof manualExtensionSchema>
) {
  const parsed = manualExtensionSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  const interval = subscription.billingInterval ?? "MONTHLY";
  const base = subscription.currentPeriodEnd ?? new Date();

  let days = 30;
  if (parsed.mode === "MONTH_3") days = 90;
  else if (parsed.mode === "MONTH_6") days = 180;
  else if (parsed.mode === "MONTH_12") days = 365;
  else if (parsed.mode === "CUSTOM_DAYS") days = parsed.customDays ?? 30;

  const newEnd = addDays(base, days);
  const before = {
    currentPeriodEnd: subscription.currentPeriodEnd,
    status: subscription.status,
  };

  await db.$transaction(async (tx) => {
    await tx.companySubscription.update({
      where: { id: subscriptionId },
      data: {
        currentPeriodEnd: newEnd,
        nextBillingAt: subscription.autoRenew ? newEnd : subscription.nextBillingAt,
        status:
          subscription.status === "EXPIRED" || subscription.status === "PAST_DUE"
            ? "ACTIVE"
            : subscription.status,
        graceEndsAt: null,
        failedPaymentCount: 0,
      },
    });

    if (parsed.extensionType === "MANUAL_PAYMENT") {
      const resolved = subscription.planId
        ? await resolveSubscriptionPrice({
            companyId: subscription.companyId,
            planId: subscription.planId,
            billingInterval: interval,
          })
        : null;

      await tx.membershipPayment.create({
        data: {
          companyId: subscription.companyId,
          planId: subscription.planId,
          subscriptionId,
          period: interval,
          periodStart: base,
          periodEnd: newEnd,
          amount: parsed.amountMinor / 100,
          amountMinor: parsed.amountMinor,
          status: "PAID",
          type: "MANUAL_RENEWAL",
          providerEnum: "MANUAL",
          paymentMethod: "MANUAL",
          paidAt: new Date(),
          note: parsed.paymentNote ?? parsed.reason,
          planNameSnapshot: subscription.plan?.name,
          priceSnapshot: resolved
            ? (JSON.parse(JSON.stringify(resolved)) as Prisma.InputJsonValue)
            : undefined,
          initiatedByUserId: actorUserId,
        },
      });
    }
  });

  const refreshed = await db.companySubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (refreshed) {
    await syncSubscriptionLegacy(subscription.companyId, refreshed);
  }

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action:
      parsed.extensionType === "COMPLIMENTARY"
        ? "COMPLIMENTARY_EXTENSION"
        : "MANUAL_PAYMENT_EXTENSION",
    reason: parsed.reason,
    before,
    after: { currentPeriodEnd: newEnd, days, extensionType: parsed.extensionType },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: "SUBSCRIPTION_MANUALLY_EXTENDED",
    payload: {
      extensionType: parsed.extensionType,
      days,
      complimentary: parsed.extensionType === "COMPLIMENTARY",
    },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}

export async function listAdminSubscriptionPlans() {
  return db.membershipPlan.findMany({
    where: { planStatus: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function listAdminSubscriptionPartners() {
  return db.partnerProfile.findMany({
    where: { status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, referralCode: true },
    take: 500,
  });
}

export type RepairMissingSubscriptionsInput = {
  dryRun?: boolean;
  companyId?: string;
  limit?: number;
  actorUserId?: string;
  confirm?: boolean;
};

export type RepairMissingSubscriptionsResult = {
  dryRun: boolean;
  missingCount: number;
  created: number;
  skipped: number;
  items: Array<{
    companyId: string;
    companyName: string;
    action: "would_create" | "created" | "skipped";
    planName?: string;
    trialEndsAt?: string | null;
    settingsStatus?: string | null;
    conflict?: string | null;
  }>;
};

export async function repairMissingSubscriptions(
  input: RepairMissingSubscriptionsInput = {}
): Promise<RepairMissingSubscriptionsResult> {
  const dryRun = input.dryRun ?? false;
  const limit = input.limit ?? 100;

  if (!dryRun && !input.confirm) {
    throw new AdminSubscriptionError(
      "Onay gerekli: confirm=true gönderin veya --apply kullanın.",
      400
    );
  }

  const where = input.companyId
    ? { id: input.companyId, subscription: null }
    : { subscription: null };

  const companies = await db.company.findMany({
    where,
    take: limit,
    include: { settings: true },
  });

  const defaultPlan = await getDefaultMembershipPlan();
  const items: RepairMissingSubscriptionsResult["items"] = [];
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const existing = await db.companySubscription.findUnique({
      where: { companyId: company.id },
    });

    if (existing) {
      skipped += 1;
      items.push({
        companyId: company.id,
        companyName: company.name,
        action: "skipped",
        conflict: "subscription_exists",
      });
      continue;
    }

    const preview = {
      companyId: company.id,
      companyName: company.name,
      action: dryRun ? ("would_create" as const) : ("created" as const),
      planName: defaultPlan.name,
      trialEndsAt: company.settings?.nextPaymentDate?.toISOString() ?? null,
      settingsStatus: company.settings?.membershipStatus ?? null,
      conflict: null as string | null,
    };

    if (!dryRun) {
      const subscription = await ensureCompanySubscription(company.id);
      created += 1;

      if (input.actorUserId) {
        await logSubscriptionAdminAction({
          actorUserId: input.actorUserId,
          companyId: company.id,
          subscriptionId: subscription.id,
          action: "SUBSCRIPTION_REPAIR_CREATED",
          reason: "Eksik abonelik onarımı",
          before: null,
          after: { subscriptionId: subscription.id },
        });
      }

      await syncSubscriptionLegacy(company.id, subscription);
    }

    items.push(preview);
  }

  return {
    dryRun,
    missingCount: companies.length,
    created,
    skipped,
    items,
  };
}

/** @deprecated Liste GET sırasında çağrılmamalı — repairMissingSubscriptions kullanın */
export async function ensureSubscriptionsBackfill(limit = 100) {
  return repairMissingSubscriptions({ limit, confirm: true, dryRun: false });
}

export const priceLockSchema = z.object({
  action: z.enum([
    "LOCK_CURRENT",
    "LOCK_CUSTOM",
    "LOCK_UNTIL",
    "GRANDFATHERED",
    "UNLOCK",
    "SWITCH_TO_ACTIVE_AT_RENEWAL",
  ]),
  priceMinor: z.number().int().positive().optional(),
  lockedUntil: z.string().datetime().optional(),
  reason: reasonSchema,
  expectedUpdatedAt: z.string().optional(),
});

export async function updateSubscriptionPriceLock(
  subscriptionId: string,
  actorUserId: string,
  input: z.infer<typeof priceLockSchema>
) {
  const parsed = priceLockSchema.parse(input);
  await assertVersion(subscriptionId, parsed.expectedUpdatedAt);
  await assertNoProcessingBillingRun(subscriptionId);

  const subscription = await loadSubscriptionOrThrow(subscriptionId);
  if (!subscription.planId || !subscription.billingInterval) {
    throw new AdminSubscriptionError("Plan ve dönem atanmış abonelik gerekir.");
  }

  const before = {
    priceLockType: subscription.priceLockType,
    lockedPriceMinor: subscription.lockedPriceMinor,
    priceLockedUntil: subscription.priceLockedUntil,
    lockedPlanPriceId: subscription.lockedPlanPriceId,
  };

  let data: Prisma.CompanySubscriptionUpdateInput = {};
  let outboxType: BillingOutboxEventType = "SUBSCRIPTION_PRICE_LOCKED";

  if (parsed.action === "UNLOCK") {
    data = {
      priceLockType: null,
      lockedPriceMinor: null,
      lockedListPriceMinor: null,
      lockedPlanPrice: { disconnect: true },
      priceLockedUntil: null,
    };
    outboxType = "SUBSCRIPTION_PRICE_UNLOCKED";
  } else if (parsed.action === "GRANDFATHERED") {
    const resolved = await resolveSubscriptionPrice({
      companyId: subscription.companyId,
      planId: subscription.planId,
      billingInterval: subscription.billingInterval,
      isRenewal: true,
    });
    data = {
      priceLockType: "GRANDFATHERED",
      lockedPriceMinor: resolved.totalMinor,
      lockedListPriceMinor: resolved.listPriceMinor,
      priceLockedUntil: null,
    };
  } else if (parsed.action === "LOCK_CURRENT") {
    const resolved = await resolveSubscriptionPrice({
      companyId: subscription.companyId,
      planId: subscription.planId,
      billingInterval: subscription.billingInterval,
      isRenewal: true,
    });
    const activePrice = await db.membershipPlanPrice.findFirst({
      where: {
        planId: subscription.planId,
        billingInterval: subscription.billingInterval,
        status: "ACTIVE",
      },
      orderBy: { version: "desc" },
    });
    data = {
      priceLockType: "NEXT_RENEWAL",
      lockedPriceMinor: resolved.totalMinor,
      lockedListPriceMinor: resolved.listPriceMinor,
      lockedPlanPrice: activePrice ? { connect: { id: activePrice.id } } : undefined,
      priceLockedUntil: null,
    };
  } else if (parsed.action === "LOCK_CUSTOM") {
    if (!parsed.priceMinor) {
      throw new AdminSubscriptionError("Özel tutar gerekli.");
    }
    data = {
      priceLockType: "NEXT_RENEWAL",
      lockedPriceMinor: parsed.priceMinor,
      priceLockedUntil: null,
    };
  } else if (parsed.action === "LOCK_UNTIL") {
    if (!parsed.lockedUntil) {
      throw new AdminSubscriptionError("Kilit bitiş tarihi gerekli.");
    }
    const resolved = await resolveSubscriptionPrice({
      companyId: subscription.companyId,
      planId: subscription.planId,
      billingInterval: subscription.billingInterval,
      isRenewal: true,
    });
    data = {
      priceLockType: "AFTER_DATE",
      lockedPriceMinor: parsed.priceMinor ?? resolved.totalMinor,
      priceLockedUntil: new Date(parsed.lockedUntil),
    };
  } else if (parsed.action === "SWITCH_TO_ACTIVE_AT_RENEWAL") {
    const activePrice = await db.membershipPlanPrice.findFirst({
      where: {
        planId: subscription.planId,
        billingInterval: subscription.billingInterval,
        status: "ACTIVE",
      },
      orderBy: { version: "desc" },
    });
    data = {
      priceLockType: null,
      lockedPriceMinor: null,
      lockedListPriceMinor: null,
      lockedPlanPrice: { disconnect: true },
      priceLockedUntil: null,
      nextPlanPrice: activePrice ? { connect: { id: activePrice.id } } : undefined,
      nextPriceEffectiveAt: subscription.currentPeriodEnd,
    };
    outboxType = "SUBSCRIPTION_PRICE_UNLOCKED";
  }

  const updated = await db.companySubscription.update({
    where: { id: subscriptionId },
    data,
  });

  await syncSubscriptionLegacy(subscription.companyId, updated);

  await logSubscriptionAdminAction({
    actorUserId,
    companyId: subscription.companyId,
    subscriptionId,
    action: `PRICE_LOCK_${parsed.action}`,
    reason: parsed.reason,
    before,
    after: {
      priceLockType: updated.priceLockType,
      lockedPriceMinor: updated.lockedPriceMinor,
      priceLockedUntil: updated.priceLockedUntil,
    },
  });

  await enqueueAdminSubscriptionOutbox({
    companyId: subscription.companyId,
    subscriptionId,
    type: outboxType,
    payload: { action: parsed.action },
  });

  return getAdminSubscriptionDetail(subscriptionId);
}
