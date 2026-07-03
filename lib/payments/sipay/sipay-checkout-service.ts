import "server-only";

import type { MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getDefaultMembershipPlan, MembershipServiceError } from "@/lib/membership-service";
import { getMembershipPeriodLabel } from "@/lib/membership-utils";
import type { CheckoutProvider } from "../checkout-provider";
import { canFinalize, canCancel, isTerminalStatus, assertValidTransition } from "./sipay-state-machine";
import { assertCheckStatusMatchesAttempt } from "./sipay-verification";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-transaction-utils";
import { SipayCheckstatusUnavailableError } from "./sipay-errors";
import { normalizeCurrency } from "@/lib/payments/money";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import { resolvePaidPeriod, periodMonths, nextBillingDate } from "@/lib/billing/billing-period-utils";
import {
  finalizeDiscountRedemptions,
  reserveDiscountRedemptions,
} from "@/lib/billing/discount-reservation-service";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { applyPendingChangeAfterSuccessfulPayment } from "@/lib/billing/subscription-pending-change-service";
import { syncLegacyMembershipSettings } from "@/lib/billing/subscription-legacy-sync";
import { getSipayEnv, getSipayBaseUrl } from "./sipay-env";
import { createSipayProvider } from "./sipay-provider";
import { generateSipayInvoiceId, generatePayloadHash } from "./sipay-invoice-id";

type Tx = Prisma.TransactionClient;

let providerFactory: () => CheckoutProvider = createSipayProvider;

export function _setSipayProviderFactoryForTests(factory: () => CheckoutProvider): void {
  providerFactory = factory;
}

export function _resetSipayProviderFactoryForTests(): void {
  providerFactory = createSipayProvider;
}

function getSipayProvider(): CheckoutProvider {
  return providerFactory();
}

export { getSipayProvider };

export type InitializeSipayCheckoutInput = {
  companyId: string;
  userId: string;
  planId?: string;
  period: MembershipPeriod;
  idempotencyKey: string;
  payerIp: string;
};

export type InitializeSipayCheckoutResult = {
  attemptId: string;
  invoiceId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: string;
  replay: boolean;
};

export async function initializeSipayCheckout(
  input: InitializeSipayCheckoutInput,
): Promise<InitializeSipayCheckoutResult> {
  const env = getSipayEnv();
  if (!env.SIPAY_ENABLED) {
    throw new MembershipServiceError("Sipay ödeme kapalı.", 503);
  }

  const [plan, company, subscription] = await Promise.all([
    input.planId
      ? db.membershipPlan.findFirst({ where: { id: input.planId, planStatus: "ACTIVE" } })
      : getDefaultMembershipPlan(),
    db.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, name: true, email: true, phone: true },
    }),
    db.companySubscription.findUnique({ where: { companyId: input.companyId } }),
  ]);

  if (!plan) throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
  if (!company) throw new MembershipServiceError("Firma bulunamadı.", 404);

  const resolved = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId: plan.id,
    billingInterval: input.period,
    isRenewal: subscription?.status === "ACTIVE",
  });

  const amountMinor = resolved.totalMinor;
  const currency = normalizeCurrency(resolved.currency);

  // Payload hash for idempotency conflict detection
  const payloadHash = generatePayloadHash({
    planId: plan.id,
    period: input.period,
    amountMinor,
    currency,
  });

  // Idempotency: find existing attempt
  const existing = await db.paymentAttempt.findUnique({
    where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
  });

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new MembershipServiceError(
        "Bu idempotency key farklı bir ödeme için kullanılmış.",
        409,
      );
    }
    // Replay: return existing checkout URL
    if (existing.checkoutUrl && existing.status === "CHECKOUT_LINK_READY") {
      return {
        attemptId: existing.id,
        invoiceId: existing.invoiceId,
        checkoutUrl: existing.checkoutUrl,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        replay: true,
      };
    }
  }

  const invoiceId = existing?.invoiceId ?? generateSipayInvoiceId();
  const { periodStart, periodEnd } = resolvePaidPeriod({
    currentPeriodEnd: subscription?.currentPeriodEnd,
    trialEndsAt: subscription?.trialEndsAt,
    period: input.period,
  });

  const priceSnapshot = {
    planId: resolved.planId,
    planPriceId: resolved.planPriceId,
    planNameSnapshot: resolved.planName,
    billingPeriodSnapshot: resolved.billingInterval,
    periodMonthsSnapshot: periodMonths(resolved.billingInterval),
    subtotalMinor: resolved.subtotalMinor,
    vatRateSnapshot: resolved.vatRate,
    vatMinor: resolved.vatMinor,
    totalMinor: resolved.totalMinor,
    currency,
    periodStart,
    periodEnd,
    isRenewal: subscription?.status === "ACTIVE",
    campaignIds: resolved.campaignIds,
    couponId: resolved.couponId,
    appliedDiscounts: resolved.appliedDiscounts,
  };

  // Get Sipay checkout link
  const provider = getSipayProvider();
  const sipayEnv = getSipayEnv();
  const baseUrl = getSipayBaseUrl(sipayEnv);
  const returnUrl = `${sipayEnv.SIPAY_RETURN_URL}?invoice_id=${encodeURIComponent(invoiceId)}`;
  const cancelUrl = `${sipayEnv.SIPAY_CANCEL_URL}?invoice_id=${encodeURIComponent(invoiceId)}`;

  const periodLabel = getMembershipPeriodLabel(input.period);

  const checkoutResult = await provider.createCheckout({
    invoiceId,
    idempotencyKey: input.idempotencyKey,
    companyId: input.companyId,
    userId: input.userId,
    amountMinor,
    currency,
    payerEmail: company.email ?? `billing+${input.companyId}@hesapisleri.com`,
    payerName: company.name,
    payerIp: input.payerIp,
    items: [
      {
        name: resolved.planName,
        description: `${resolved.planName} - ${periodLabel} üyelik ödemesi`,
        priceMinor: amountMinor,
        quantity: 1,
      },
    ],
    returnUrl,
    cancelUrl,
    testMode: sipayEnv.SIPAY_ENV === "test",
  });

  // Upsert PaymentAttempt
  const attempt = existing
    ? await db.paymentAttempt.update({
        where: { id: existing.id },
        data: {
          status: "CHECKOUT_LINK_READY",
          checkoutUrl: checkoutResult.checkoutUrl,
          payloadHash,
          priceSnapshot: priceSnapshot as Prisma.InputJsonValue,
        },
      })
    : await db.paymentAttempt.create({
        data: {
          companyId: input.companyId,
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          provider: "SIPAY",
          status: "CHECKOUT_LINK_READY",
          invoiceId,
          checkoutUrl: checkoutResult.checkoutUrl,
          planId: plan.id,
          planPriceId: resolved.planPriceId.startsWith("legacy-") ? null : resolved.planPriceId,
          priceSnapshot: priceSnapshot as Prisma.InputJsonValue,
          payerEmail: company.email ?? undefined,
          payerName: company.name,
          payerIp: input.payerIp,
          amountMinor,
          currency,
          testMode: sipayEnv.SIPAY_ENV === "test",
        },
      });

  return {
    attemptId: attempt.id,
    invoiceId,
    checkoutUrl: checkoutResult.checkoutUrl,
    amountMinor,
    currency,
    replay: false,
  };
}

export async function finalizeSipayPayment(
  invoiceId: string,
  source: "webhook" | "return",
): Promise<{ duplicate: boolean; membershipPaymentId?: string; verificationPending?: boolean }> {
  const attempt = await db.paymentAttempt.findUnique({
    where: { invoiceId },
    include: {
      company: { select: { id: true, name: true, email: true } },
    },
  });

  if (!attempt) {
    throw new MembershipServiceError(`PaymentAttempt bulunamadı: ${invoiceId}`, 404);
  }

  // Already finalized — idempotent
  if (attempt.status === "COMPLETED") {
    return { duplicate: true };
  }

  // Terminal durum (FAILED, CANCELLED, EXPIRED) — state machine ihlali
  if (isTerminalStatus(attempt.status) && !canFinalize(attempt.status)) {
    return { duplicate: false };
  }

  // Verify payment status with Sipay — return URL is NOT sole success signal
  const provider = getSipayProvider();
  let statusResult;
  try {
    statusResult = await provider.checkStatus(invoiceId);
  } catch (error) {
    if (error instanceof SipayCheckstatusUnavailableError) {
      await markSipayVerificationPending(invoiceId, source);
      return { duplicate: false, verificationPending: true };
    }
    throw error;
  }

  if (statusResult.status !== "PAID") {
    const newStatus = statusResult.status === "NOT_PAID" ? "FAILED" : attempt.status;
    await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: newStatus,
        providerStatus: statusResult.status,
        providerPaymentId: statusResult.providerPaymentId ?? null,
        ...(newStatus === "FAILED" ? { failedAt: new Date() } : {}),
      },
    });
    return { duplicate: false };
  }

  assertCheckStatusMatchesAttempt(
    {
      invoiceId: attempt.invoiceId,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      providerPaymentId: attempt.providerPaymentId,
    },
    statusResult,
  );

  const priceSnapshot = attempt.priceSnapshot as Record<string, unknown> | null;
  if (!priceSnapshot) {
    throw new MembershipServiceError("PaymentAttempt priceSnapshot eksik.", 500);
  }

  const periodStart = new Date(priceSnapshot.periodStart as string);
  const periodEnd = new Date(priceSnapshot.periodEnd as string);
  const isRenewal = Boolean(priceSnapshot.isRenewal);
  const planId = attempt.planId;
  const paidAt = new Date();

  const subscription = await db.companySubscription.findUnique({
    where: { companyId: attempt.companyId },
  });

  const membershipPaymentId = await db.$transaction(async (tx: Tx) => {
    await tx.$executeRaw`SELECT id FROM "PaymentAttempt" WHERE "invoiceId" = ${invoiceId} FOR UPDATE`;

    const fresh = await tx.paymentAttempt.findUnique({ where: { invoiceId } });
    if (!fresh) throw new MembershipServiceError("PaymentAttempt bulunamadı (lock re-read)", 404);
    if (fresh.status === "COMPLETED") return "__duplicate__";

    const existing = await tx.membershipPayment.findUnique({ where: { merchantOid: invoiceId } });
    if (existing) {
      await tx.paymentAttempt.update({
        where: { id: fresh.id },
        data: { status: "COMPLETED", paidAt: existing.paidAt ?? new Date() },
      });
      return existing.id;
    }

    let payment;
    try {
      payment = await tx.membershipPayment.create({
      data: {
        companyId: attempt.companyId,
        planId: planId ?? undefined,
        planPriceId: attempt.planPriceId ?? undefined,
        period: priceSnapshot.billingPeriodSnapshot as MembershipPeriod,
        periodStart,
        periodEnd,
        amount: attempt.amountMinor / 100,
        currency: attempt.currency,
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        type: isRenewal ? "MANUAL_RENEWAL" : "INITIAL_SUBSCRIPTION",
        providerEnum: "SIPAY",
        provider: "Sipay",
        merchantOid: invoiceId,
        idempotencyKey: attempt.idempotencyKey,
        amountMinor: attempt.amountMinor,
        subtotalMinor: (priceSnapshot.subtotalMinor as number | undefined) ?? null,
        vatMinor: (priceSnapshot.vatMinor as number | undefined) ?? null,
        planNameSnapshot: (priceSnapshot.planNameSnapshot as string | undefined) ?? null,
        billingPeriodSnapshot: (priceSnapshot.billingPeriodSnapshot as string | undefined) ?? null,
        periodMonthsSnapshot: (priceSnapshot.periodMonthsSnapshot as number | undefined) ?? null,
        priceSnapshot: priceSnapshot as Prisma.InputJsonValue,
        payerEmail: attempt.payerEmail ?? undefined,
        payerName: attempt.payerName ?? undefined,
        payerIp: attempt.payerIp ?? undefined,
        testMode: attempt.testMode,
        initiatedByUserId: attempt.userId ?? undefined,
        initiatedAt: attempt.createdAt,
        paidAt,
        callbackReceivedAt: paidAt,
        providerPaymentId: statusResult.providerPaymentId ?? null,
        providerStatus: "PAID",
      },
    });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error, "merchantOid")) {
        const raced = await tx.membershipPayment.findUnique({ where: { merchantOid: invoiceId } });
        if (raced) {
          await tx.paymentAttempt.update({
            where: { id: fresh.id },
            data: { status: "COMPLETED", paidAt: raced.paidAt ?? new Date() },
          });
          return raced.id;
        }
      }
      throw error;
    }

    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "COMPLETED",
        providerStatus: "PAID",
        providerPaymentId: statusResult.providerPaymentId ?? null,
        paidAt,
      },
    });

    // Upsert subscription
    const updatedSubscription = await tx.companySubscription.upsert({
      where: { companyId: attempt.companyId },
      create: {
        companyId: attempt.companyId,
        planId: planId ?? undefined,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: nextBillingDate(periodEnd, false),
        trialEndsAt: null,
        autoRenew: false,
        lastPaymentId: payment.id,
        lastSuccessfulPaymentId: payment.id,
        failedPaymentCount: 0,
        billingInterval: payment.period ?? undefined,
      },
      update: {
        planId: planId ?? undefined,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingAt: nextBillingDate(periodEnd, false),
        graceEndsAt: null,
        trialEndsAt: null,
        lastPaymentId: payment.id,
        lastSuccessfulPaymentId: payment.id,
        failedPaymentCount: 0,
        billingInterval: payment.period ?? undefined,
      },
    });

    if (subscription?.id) {
      await applyPendingChangeAfterSuccessfulPayment(
        { subscriptionId: subscription.id, companyId: attempt.companyId, paymentId: payment.id },
        tx,
      );
    }

    await syncLegacyMembershipSettings(
      attempt.companyId,
      { subscription: updatedSubscription, lastPaymentDate: paidAt, monthlyFeeMinor: attempt.amountMinor },
      tx,
    );

    await finalizeDiscountRedemptions(payment.id, tx);

    const priorSuccessLog = await tx.activityLog.findFirst({
      where: {
        companyId: attempt.companyId,
        module: "settings",
        message: { contains: `Sipay üyelik ödemesi onaylandı (${source}): ${invoiceId}` },
      },
    });
    if (!priorSuccessLog) {
      await tx.activityLog.create({
        data: {
          companyId: attempt.companyId,
          userId: attempt.userId ?? undefined,
          action: "UPDATE",
          module: "settings",
          message: `Sipay üyelik ödemesi onaylandı (${source}): ${invoiceId}`,
        },
      });
    }

    const priorOutbox = await tx.billingOutboxEvent.findFirst({
      where: {
        companyId: attempt.companyId,
        type: "PAYMENT_SUCCEEDED",
        aggregateId: payment.id,
      },
    });
    if (!priorOutbox) {
      await enqueueBillingOutboxEvent(
        {
          companyId: attempt.companyId,
          type: "PAYMENT_SUCCEEDED",
          aggregateType: "MembershipPayment",
          aggregateId: payment.id,
          payload: { paymentId: payment.id, invoiceId, source },
        },
        tx,
      );
    }

    return payment.id;
  });

  if (membershipPaymentId === "__duplicate__") {
    return { duplicate: true };
  }

  return { duplicate: false, membershipPaymentId };
}

export async function markSipayVerificationPending(
  invoiceId: string,
  source: "webhook" | "return",
): Promise<void> {
  const attempt = await db.paymentAttempt.findUnique({ where: { invoiceId } });
  if (!attempt || attempt.status === "COMPLETED") return;

  await db.paymentAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "PENDING",
      providerStatus: "VERIFICATION_PENDING",
    },
  });

  await db.activityLog.create({
    data: {
      companyId: attempt.companyId,
      userId: attempt.userId ?? undefined,
      action: "UPDATE",
      module: "payments",
      message: `Sipay checkstatus beklemede (${source}): ${invoiceId}`,
    },
  });
}

export async function cancelSipayAttempt(invoiceId: string): Promise<void> {
  const attempt = await db.paymentAttempt.findUnique({ where: { invoiceId } });
  if (!attempt) return;
  if (!canCancel(attempt.status)) return;
  assertValidTransition(attempt.status, "CANCELLED");
  await db.paymentAttempt.update({
    where: { id: attempt.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
}
