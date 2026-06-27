import "server-only";
import { db } from "@/lib/prisma";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import { logAdminSubscriptionAudit } from "@/lib/admin/subscriptions/admin-subscription-audit";
import { invalidateAdminSubscriptionCaches } from "@/lib/admin/subscriptions/admin-subscription-cache";
import {
  signPreviewHash,
  PREVIEW_TTL_MS,
  type PreviewCanonicalPayload,
} from "@/lib/admin/subscriptions/admin-subscription-preview-hash";
import { resolveSubscriptionPreviewSecret } from "@/lib/admin/subscriptions/admin-subscription-preview-secret";
import {
  buildCanonicalPreviewPayload,
  interpretPreviewVerification,
  validateCancellationRevoke,
  validateCancellationSchedule,
  validateTrialExtension,
} from "@/lib/admin/subscriptions/admin-subscription-action-validators";
import { verifyPreviewHash } from "@/lib/admin/subscriptions/admin-subscription-preview-hash";
import type { MembershipPeriod, SubscriptionStatus } from "@prisma/client";

function getPreviewSecret(): string {
  return resolveSubscriptionPreviewSecret();
}

async function sumActiveAddOnEffectMinor(subscriptionId: string): Promise<number> {
  const addons = await db.companyAddOnSubscription.findMany({
    where: { subscriptionId, status: { in: ["ACTIVE", "PENDING"] } },
    include: { addOnPrice: { select: { listPriceMinor: true } } },
  });
  return addons.reduce((sum, a) => sum + (a.addOnPrice?.listPriceMinor ?? 0) * a.quantity, 0);
}

function buildDiscountSummary(
  discounts: Array<{ type: string; label: string; amount: number }>
): string {
  if (!discounts.length) return "";
  return discounts.map((d) => `${d.type}:${d.label}:${d.amount}`).join("|");
}

// ---------------------------------------------------------------------------
// Trial Extension
// ---------------------------------------------------------------------------
export async function adminExtendTrial(input: {
  subscriptionId: string;
  actorUserId: string;
  days: number;
  reason: string;
  customDate?: string;
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { id: true, companyId: true, status: true, trialEndsAt: true },
  });

  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });
  const base = sub.trialEndsAt ?? new Date();
  const newDate = input.customDate
    ? new Date(input.customDate)
    : new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000);

  const trialValidation = validateTrialExtension({
    status: sub.status,
    days: input.days,
    baseDate: base,
    customDate: input.customDate ? newDate : undefined,
  });
  if (!trialValidation.ok) {
    throw Object.assign(new Error(trialValidation.message), { status: trialValidation.status });
  }

  const prev = sub.trialEndsAt?.toISOString() ?? null;
  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: { trialEndsAt: newDate, trialExtensionReason: input.reason },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_TRIAL_EXTENDED",
    reason: input.reason,
    before: { trialEndsAt: prev },
    after: { trialEndsAt: newDate.toISOString() },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return { newTrialEndsAt: newDate.toISOString() };
}

// ---------------------------------------------------------------------------
// Plan Change Preview
// ---------------------------------------------------------------------------
export async function adminPreviewPlanChange(input: {
  subscriptionId: string;
  actorUserId: string;
  targetPlanId: string;
  targetBillingInterval: MembershipPeriod;
  applyAt: "IMMEDIATELY" | "NEXT_PERIOD";
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      companyId: true,
      planId: true,
      lockedPlanPriceId: true,
      billingInterval: true,
      status: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });

  const activeStatuses: SubscriptionStatus[] = [
    "ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END",
  ];
  if (!activeStatuses.includes(sub.status)) {
    throw Object.assign(
      new Error("Plan değişikliği yalnızca aktif abonelikler için geçerlidir"),
      { status: 400 }
    );
  }

  const targetPlan = await db.membershipPlan.findUnique({
    where: { id: input.targetPlanId },
    select: { id: true, name: true, code: true, planStatus: true },
  });
  if (!targetPlan || targetPlan.planStatus !== "ACTIVE") {
    throw Object.assign(new Error("Hedef plan bulunamadı veya aktif değil"), { status: 400 });
  }

  const resolvedPrice = await resolveSubscriptionPrice({
    companyId: sub.companyId,
    planId: input.targetPlanId,
    billingInterval: input.targetBillingInterval,
  });

  const effectiveAt =
    input.applyAt === "IMMEDIATELY"
      ? new Date().toISOString()
      : (sub.currentPeriodEnd?.toISOString() ?? new Date().toISOString());

  const issuedAt = Date.now();
  const expiresAt = issuedAt + PREVIEW_TTL_MS;
  const addOnEffectMinor = await sumActiveAddOnEffectMinor(input.subscriptionId);
  const discounts =
    resolvedPrice.appliedDiscounts?.map((d) => ({
      type: d.type,
      label: d.label,
      amount: d.amountMinor,
    })) ?? [];

  const canonicalPayload = buildCanonicalPreviewPayload({
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    currentPlanId: sub.planId,
    currentPlanPriceId: sub.lockedPlanPriceId,
    currentBillingInterval: sub.billingInterval,
    targetPlanId: input.targetPlanId,
    targetPlanPriceId: resolvedPrice.planPriceId,
    targetBillingInterval: input.targetBillingInterval,
    currency: resolvedPrice.currency,
    listPriceMinor: resolvedPrice.listPriceMinor,
    salePriceMinor: resolvedPrice.salePriceMinor,
    monthlyEquivalentMinor: resolvedPrice.monthlyEquivalentMinor,
    discountSummary: buildDiscountSummary(discounts),
    couponId: resolvedPrice.couponId ?? null,
    campaignId: resolvedPrice.campaignIds[0] ?? null,
    activeAddOnEffectMinor: addOnEffectMinor,
    effectiveMode: input.applyAt,
    issuedAt,
    expiresAt,
  });

  const previewHash = signPreviewHash(canonicalPayload, getPreviewSecret());

  const [currentPlanEntitlements, targetPlanEntitlements] = await Promise.all([
    sub.planId
      ? db.planEntitlement.findMany({
          where: { planId: sub.planId },
          select: { code: true, booleanValue: true, numberValue: true },
        })
      : Promise.resolve([]),
    db.planEntitlement.findMany({
      where: { planId: input.targetPlanId },
      select: { code: true, booleanValue: true, numberValue: true },
    }),
  ]);

  const targetCodes = new Set(targetPlanEntitlements.map((e) => e.code));
  const entitlementDiff = [
    ...targetPlanEntitlements
      .filter((t) => {
        const cur = currentPlanEntitlements.find((c) => c.code === t.code);
        const curVal = cur?.booleanValue ?? cur?.numberValue;
        const newVal = t.booleanValue ?? t.numberValue;
        return curVal !== newVal;
      })
      .map((t) => ({
        code: t.code,
        from: currentPlanEntitlements.find((c) => c.code === t.code)?.booleanValue ??
          currentPlanEntitlements.find((c) => c.code === t.code)?.numberValue ??
          null,
        to: t.booleanValue ?? t.numberValue,
      })),
    ...currentPlanEntitlements
      .filter((c) => !targetCodes.has(c.code))
      .map((c) => ({
        code: c.code,
        from: c.booleanValue ?? c.numberValue,
        to: null,
      })),
  ];

  const previewData = {
    subscriptionId: input.subscriptionId,
    currentPlanId: sub.planId,
    currentInterval: sub.billingInterval,
    targetPlanId: input.targetPlanId,
    targetPlanName: targetPlan.name,
    targetInterval: input.targetBillingInterval,
    applyAt: input.applyAt,
    effectiveAt,
    previewExpiresAt: new Date(expiresAt).toISOString(),
    entitlementDiff,
    pricing: {
      listPriceMinor: resolvedPrice.listPriceMinor,
      salePriceMinor: resolvedPrice.salePriceMinor,
      monthlyEquivalentMinor: resolvedPrice.monthlyEquivalentMinor,
      currency: resolvedPrice.currency,
      vatRate: resolvedPrice.vatRate,
      vatIncluded: resolvedPrice.vatIncluded,
      discounts:
        resolvedPrice.appliedDiscounts?.map((d) => ({
          type: d.type,
          label: d.label,
          amount: d.amountMinor,
        })) ?? [],
    },
  };

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_PLAN_CHANGE_PREVIEWED",
    metadata: {
      targetPlanId: input.targetPlanId,
      targetInterval: input.targetBillingInterval,
      applyAt: input.applyAt,
    },
  });

  return { ...previewData, previewHash };
}

// ---------------------------------------------------------------------------
// Apply Plan Change
// ---------------------------------------------------------------------------
export async function adminApplyPlanChange(input: {
  subscriptionId: string;
  actorUserId: string;
  previewHash: string;
  targetPlanId: string;
  targetBillingInterval: MembershipPeriod;
  applyAt: "IMMEDIATELY" | "NEXT_PERIOD";
  reason: string;
}) {
  // 1) Re-resolve current price to build fresh canonical payload
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      companyId: true,
      planId: true,
      billingInterval: true,
      lockedPlanPriceId: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });

  const resolvedPrice = await resolveSubscriptionPrice({
    companyId: sub.companyId,
    planId: input.targetPlanId,
    billingInterval: input.targetBillingInterval,
  });

  const tokenExpiresAt = Number(input.previewHash.split(".")[1]);
  const addOnEffectMinor = await sumActiveAddOnEffectMinor(input.subscriptionId);
  const discounts =
    resolvedPrice.appliedDiscounts?.map((d) => ({
      type: d.type,
      label: d.label,
      amount: d.amountMinor,
    })) ?? [];

  const freshPayload = buildCanonicalPreviewPayload({
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    currentPlanId: sub.planId,
    currentPlanPriceId: sub.lockedPlanPriceId,
    currentBillingInterval: sub.billingInterval,
    targetPlanId: input.targetPlanId,
    targetPlanPriceId: resolvedPrice.planPriceId,
    targetBillingInterval: input.targetBillingInterval,
    currency: resolvedPrice.currency,
    listPriceMinor: resolvedPrice.listPriceMinor,
    salePriceMinor: resolvedPrice.salePriceMinor,
    monthlyEquivalentMinor: resolvedPrice.monthlyEquivalentMinor,
    discountSummary: buildDiscountSummary(discounts),
    couponId: resolvedPrice.couponId ?? null,
    campaignId: resolvedPrice.campaignIds[0] ?? null,
    activeAddOnEffectMinor: addOnEffectMinor,
    effectiveMode: input.applyAt,
    issuedAt: tokenExpiresAt ? tokenExpiresAt - PREVIEW_TTL_MS : Date.now(),
    expiresAt: tokenExpiresAt,
  });

  const verification = verifyPreviewHash(input.previewHash, freshPayload, getPreviewSecret());
  const previewCheck = interpretPreviewVerification(verification);
  if (!previewCheck.ok) {
    throw Object.assign(new Error(previewCheck.message), {
      status: previewCheck.status,
      code: previewCheck.code,
    });
  }

  // 3) Resolve locked price row for the new plan
  const newPlanPrice = await db.membershipPlanPrice.findFirst({
    where: {
      planId: input.targetPlanId,
      billingInterval: input.targetBillingInterval,
      effectiveFrom: { lte: new Date() },
      status: "ACTIVE",
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date() } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, salePriceMinor: true, monthlyEquivalentMinor: true, currency: true },
  });

  // 4) Apply or schedule
  if (input.applyAt === "IMMEDIATELY") {
    await db.companySubscription.update({
      where: { id: input.subscriptionId },
      data: {
        planId: input.targetPlanId,
        billingInterval: input.targetBillingInterval,
        lockedPlanPriceId: newPlanPrice?.id ?? undefined,
        lockedPriceMinor: newPlanPrice?.salePriceMinor ?? undefined,
      },
    });
  } else {
    await db.subscriptionPendingChange.create({
      data: {
        subscriptionId: input.subscriptionId,
        changeType: "PLAN_AND_INTERVAL",
        targetPlanId: input.targetPlanId,
        targetBillingInterval: input.targetBillingInterval,
        targetPlanPriceId: newPlanPrice?.id ?? null,
        reason: input.reason,
        requestedByUserId: input.actorUserId,
        effectiveAt: sub.currentPeriodEnd ?? new Date(),
        status: "PENDING",
      },
    });
  }

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_PLAN_CHANGED",
    reason: input.reason,
    before: { planId: sub.planId, interval: sub.billingInterval },
    after: {
      planId: input.targetPlanId,
      interval: input.targetBillingInterval,
      applyAt: input.applyAt,
    },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return { success: true, applyAt: input.applyAt };
}

// ---------------------------------------------------------------------------
// Schedule Cancellation
// ---------------------------------------------------------------------------
export async function adminScheduleCancellation(input: {
  subscriptionId: string;
  actorUserId: string;
  reason: string;
  internalNote?: string;
  notifyUser: boolean;
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      companyId: true,
      status: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
    },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });

  const scheduleValidation = validateCancellationSchedule({
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
  if (!scheduleValidation.ok) {
    throw Object.assign(new Error(scheduleValidation.message), {
      status: scheduleValidation.status,
    });
  }

  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      cancelAtPeriodEnd: true,
      status: "CANCEL_AT_PERIOD_END",
      cancellationScheduledAt: new Date(),
      cancellationScheduledByAdminId: input.actorUserId,
      internalCancellationNote: input.internalNote ?? null,
    },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
    reason: input.reason,
    after: { cancelAtPeriodEnd: true, scheduledAt: new Date().toISOString() },
    metadata: { notifyUser: input.notifyUser },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return { cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null };
}

// ---------------------------------------------------------------------------
// Revoke Cancellation
// ---------------------------------------------------------------------------
export async function adminRevokeCancellation(input: {
  subscriptionId: string;
  actorUserId: string;
  reason: string;
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { id: true, companyId: true, status: true, cancelAtPeriodEnd: true },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });
  const revokeValidation = validateCancellationRevoke({
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  });
  if (!revokeValidation.ok) {
    throw Object.assign(new Error(revokeValidation.message), { status: revokeValidation.status });
  }

  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      cancelAtPeriodEnd: false,
      status: "ACTIVE",
      cancellationScheduledAt: null,
      cancellationScheduledByAdminId: null,
      internalCancellationNote: null,
    },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_CANCELLATION_REVOKED",
    reason: input.reason,
    after: { cancelAtPeriodEnd: false },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Provider Sync (PayTR: manual/iframe — no live provider query available)
// ---------------------------------------------------------------------------
export async function adminSyncProvider(input: {
  subscriptionId: string;
  actorUserId: string;
  force: boolean;
}) {
  const sub = await db.companySubscription.findUnique({
    where: { id: input.subscriptionId },
    select: { id: true, companyId: true, lastProviderSyncAt: true },
  });
  if (!sub) throw Object.assign(new Error("Abonelik bulunamadı"), { status: 404 });

  // Derive provider from last payment (CompanySubscription has no provider field)
  const lastPayment = await db.membershipPayment.findFirst({
    where: { subscriptionId: input.subscriptionId },
    orderBy: { createdAt: "desc" },
    select: { providerEnum: true },
  });
  const provider = lastPayment?.providerEnum ?? "PAYTR";

  // PayTR iframe/manual — no live subscription query is available.
  if (provider === "PAYTR" || provider === "MANUAL") {
    await db.companySubscription.update({
      where: { id: input.subscriptionId },
      data: {
        lastProviderSyncAt: new Date(),
        lastProviderSyncStatus: "NOT_SUPPORTED_PAYTR_MANUAL",
      },
    });

    await logAdminSubscriptionAudit({
      actorUserId: input.actorUserId,
      subscriptionId: input.subscriptionId,
      companyId: sub.companyId,
      action: "SUBSCRIPTION_PROVIDER_SYNCED",
      // Credential response'a çıkmaz — yalnız provider tipi ve sonuç kaydedilir
      metadata: {
        provider,
        syncStatus: "NOT_SUPPORTED_PAYTR_MANUAL",
        note: "PayTR iframe/manual — live query not available",
      },
    });

    invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
    return {
      synced: false,
      provider,
      message:
        "PayTR abonelikleri için gerçek zamanlı provider sorgulama desteklenmez. Sync zamanı güncellendi.",
      lastSyncAt: new Date().toISOString(),
    };
  }

  // Legacy provider — timestamp only
  await db.companySubscription.update({
    where: { id: input.subscriptionId },
    data: {
      lastProviderSyncAt: new Date(),
      lastProviderSyncStatus: "LEGACY_NO_SYNC",
    },
  });

  await logAdminSubscriptionAudit({
    actorUserId: input.actorUserId,
    subscriptionId: input.subscriptionId,
    companyId: sub.companyId,
    action: "SUBSCRIPTION_PROVIDER_SYNCED",
    metadata: { provider, syncStatus: "LEGACY_NO_SYNC" },
  });

  invalidateAdminSubscriptionCaches(input.subscriptionId, sub.companyId);
  return {
    synced: false,
    provider,
    message: "Legacy provider — sync desteklenmez.",
    lastSyncAt: new Date().toISOString(),
  };
}
