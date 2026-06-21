import "server-only";

import type { MembershipPeriod, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { getDefaultMembershipPlan, MembershipServiceError } from "@/lib/membership-service";
import { createPartnerPaymentConversion } from "@/lib/partner-conversion-service";
import { normalizeCurrency } from "@/lib/payments/money";
import { generatePaytrMerchantOid } from "@/lib/payments/merchant-oid";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import {
  buildPaytrWebhookEventKey,
  verifyPaytrCallback,
} from "@/lib/payments/providers/paytr/paytr-callback";
import {
  encryptPaymentToken,
  fingerprintPaymentToken,
} from "@/lib/payments/payment-token-crypto";
import { getPaytrConfig } from "@/lib/payments/providers/paytr/paytr-config";
import {
  assertPaytrCheckoutOptionsAllowed,
  getPaytrCapabilities,
  normalizePaytrCheckoutOptions,
  resolveAutoRenewFromPaymentMetadata,
} from "@/lib/payments/paytr-capabilities";
import { resolvePaidPeriod, periodMonths, nextBillingDate } from "@/lib/billing/billing-period-utils";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import {
  finalizeDiscountRedemptions,
  releaseDiscountRedemptions,
  reserveDiscountRedemptions,
} from "@/lib/billing/discount-reservation-service";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { applyPendingChangeAfterSuccessfulPayment } from "@/lib/billing/subscription-pending-change-service";
import { syncLegacyMembershipSettings } from "@/lib/billing/subscription-legacy-sync";
import { activateAddOnAfterPayment } from "@/lib/billing/addons/addon-purchase-service";
import { applyStatusStepsBeforePaid, assertPaymentTransition } from "@/lib/payments/payment-state-machine";
import {
  resolvePendingForInitialize,
  resumePaytrMembershipPayment,
} from "@/lib/payments/pending-membership-payment";

export {
  cancelMembershipPayment,
  expireStalePendingMembershipPayments,
  findPendingMembershipPayment,
  resumePaytrMembershipPayment,
} from "@/lib/payments/pending-membership-payment";

type Tx = Prisma.TransactionClient;

function paymentProviderLabel(method: "PAYTR" | "BANK_TRANSFER" | "MANUAL") {
  if (method === "PAYTR") return "PayTR";
  if (method === "BANK_TRANSFER") return "BANK_TRANSFER";
  return "MANUAL";
}

async function buildSnapshot(input: {
  companyId: string;
  planId: string;
  period: MembershipPeriod;
  couponCode?: string | null;
  isRenewal?: boolean;
}) {
  const resolved = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId: input.planId,
    billingInterval: input.period,
    couponCode: input.couponCode,
    isRenewal: input.isRenewal,
  });

  return {
    planId: resolved.planId,
    planPriceId: resolved.planPriceId,
    priceVersion: resolved.priceVersion,
    planNameSnapshot: resolved.planName,
    billingPeriodSnapshot: resolved.billingInterval,
    periodMonthsSnapshot: periodMonths(resolved.billingInterval),
    listPriceMinor: resolved.listPriceMinor,
    basePriceMinor: resolved.salePriceMinor,
    discountMinor: resolved.discountMinor,
    campaignDiscountMinor: resolved.appliedDiscounts
      .filter((item) => item.type === "CAMPAIGN")
      .reduce((sum, item) => sum + item.amountMinor, 0),
    couponDiscountMinor: resolved.appliedDiscounts
      .filter((item) => item.type === "COUPON")
      .reduce((sum, item) => sum + item.amountMinor, 0),
    subtotalMinor: resolved.subtotalMinor,
    vatRateSnapshot: resolved.vatRate,
    vatMinor: resolved.vatMinor,
    totalMinor: resolved.totalMinor,
    currency: normalizeCurrency(resolved.currency),
    campaignIds: resolved.campaignIds,
    couponId: resolved.couponId,
    priceSource: resolved.priceSource,
    appliedDiscounts: resolved.appliedDiscounts,
    priceExplanation: resolved.explanation,
    planEntitlementsSnapshot: resolved.entitlementsSnapshot,
  };
}

export async function initializePaytrMembershipPayment(input: {
  companyId: string;
  userId: string;
  planId?: string;
  period: MembershipPeriod;
  autoRenew: boolean;
  saveCard: boolean;
  consentVersion?: string;
  idempotencyKey: string;
  couponCode?: string | null;
  payerIp: string;
  forceNew?: boolean;
}) {
  if (input.autoRenew && !input.saveCard) {
    throw new MembershipServiceError(
      "Otomatik yenileme için kart saklama onayı gereklidir.",
      400
    );
  }

  const config = getPaytrConfig();
  const paytrCapabilities = getPaytrCapabilities(config);

  try {
    assertPaytrCheckoutOptionsAllowed(paytrCapabilities, {
      autoRenew: input.autoRenew,
      saveCard: input.saveCard,
    });
  } catch (error) {
    throw new MembershipServiceError(
      error instanceof Error ? error.message : "PayTR ödeme seçenekleri geçersiz.",
      400
    );
  }

  const checkoutOptions = normalizePaytrCheckoutOptions(paytrCapabilities, {
    autoRenew: input.autoRenew,
    saveCard: input.saveCard,
  });

  if (config.integrationMode === "direct" && !config.directApiEnabled) {
    throw new MembershipServiceError(
      "PayTR Direkt API kapalı. .env dosyasına PAYTR_DIRECT_API_ENABLED=true ekleyin veya PAYTR_INTEGRATION_MODE=iframe kullanın.",
      503
    );
  }

  const [plan, company, subscription] = await Promise.all([
    input.planId
      ? db.membershipPlan.findFirst({ where: { id: input.planId, isActive: true } })
      : getDefaultMembershipPlan(),
    db.company.findUnique({
      where: { id: input.companyId },
      include: { users: { take: 1, include: { user: true } } },
    }),
    db.companySubscription.findUnique({ where: { companyId: input.companyId } }),
  ]);

  if (!plan) throw new MembershipServiceError("Aktif üyelik paketi bulunamadı.", 404);
  if (!company) throw new MembershipServiceError("Firma bulunamadı.", 404);

  const pendingResolution = await resolvePendingForInitialize({
    companyId: input.companyId,
    planId: plan.id,
    period: input.period,
    couponCode: input.couponCode,
    forceNew: input.forceNew,
  });

  if (pendingResolution.resume && pendingResolution.pending) {
    return resumePaytrMembershipPayment({
      companyId: input.companyId,
      paymentId: pendingResolution.pending.id,
      payerIp: input.payerIp,
    });
  }

  const snapshot = await buildSnapshot({
    companyId: input.companyId,
    planId: plan.id,
    period: input.period,
    couponCode: input.couponCode,
    isRenewal: subscription?.status === "ACTIVE",
  });
  const { periodStart, periodEnd } = resolvePaidPeriod({
    currentPeriodEnd: subscription?.currentPeriodEnd,
    trialEndsAt: subscription?.trialEndsAt,
    period: input.period,
  });
  const merchantOid = generatePaytrMerchantOid();
  const payerEmail = company.email ?? company.users[0]?.user.email ?? "billing@hesapisleri.com";
  const payerName = company.name;
  const payerPhone = company.phone ?? "0000000000";

  const payment = await db.membershipPayment.create({
    data: {
      companyId: input.companyId,
      planId: plan.id,
      planPriceId:
        snapshot.planPriceId.startsWith("legacy-") ||
        snapshot.planPriceId === "grandfathered"
          ? null
          : snapshot.planPriceId,
      period: input.period,
      periodStart,
      periodEnd,
      amount: snapshot.totalMinor / 100,
      currency: snapshot.currency,
      status: "CREATED",
      paymentMethod: "PAYTR",
      type: subscription?.status === "ACTIVE" ? "MANUAL_RENEWAL" : "INITIAL_SUBSCRIPTION",
      providerEnum: "PAYTR",
      provider: paymentProviderLabel("PAYTR"),
      merchantOid,
      idempotencyKey: input.idempotencyKey,
      amountMinor: snapshot.totalMinor,
      subtotalMinor: snapshot.subtotalMinor,
      vatMinor: snapshot.vatMinor,
      discountMinor: snapshot.discountMinor,
      planNameSnapshot: snapshot.planNameSnapshot,
      billingPeriodSnapshot: snapshot.billingPeriodSnapshot,
      periodMonthsSnapshot: snapshot.periodMonthsSnapshot,
      priceSnapshot: snapshot as Prisma.InputJsonValue,
      planEntitlementsSnapshot: snapshot.planEntitlementsSnapshot as Prisma.InputJsonValue,
      payerEmail,
      payerName,
      payerPhone,
      payerIp: input.payerIp,
      testMode: config.testMode,
      initiatedByUserId: input.userId,
      initiatedAt: new Date(),
      metadata: {
        autoRenew: checkoutOptions.autoRenew,
        saveCard: checkoutOptions.saveCard,
        consentVersion: checkoutOptions.saveCard ? input.consentVersion : undefined,
        couponCode: input.couponCode ?? null,
        campaignIds: snapshot.campaignIds,
        couponId: snapshot.couponId ?? null,
      },
    },
  });

  await reserveDiscountRedemptions({
    companyId: input.companyId,
    subscriptionId: subscription?.id,
    paymentId: payment.id,
    billingInterval: input.period,
    campaignIds: snapshot.campaignIds,
    couponId: snapshot.couponId ?? null,
    campaignDiscounts: snapshot.appliedDiscounts
      .filter((item) => item.type === "CAMPAIGN" && item.id)
      .map((item) => ({ id: item.id!, amountMinor: item.amountMinor })),
    couponDiscount: snapshot.couponId
      ? {
          id: snapshot.couponId,
          amountMinor: snapshot.couponDiscountMinor,
        }
      : null,
    idempotencyKey: input.idempotencyKey,
  });

  const adapter = createPaytrAdapter();
  const payload = await adapter.createInitialPayment({
    merchantOid,
    amountMinor: snapshot.totalMinor,
    currency: snapshot.currency,
    payerEmail,
    payerName,
    payerPhone,
    payerIp: input.payerIp,
    okUrl: `${config.okUrl}?paymentId=${payment.id}`,
    failUrl: `${config.failUrl}?paymentId=${payment.id}`,
    basket: [
      {
        name: `${plan.name} - ${input.period}`,
        amountMinor: snapshot.totalMinor,
        quantity: 1,
      },
    ],
    saveCard: checkoutOptions.saveCard,
    testMode: config.testMode,
  });

  await db.membershipPayment.update({
    where: { id: payment.id },
    data: {
      status: "FORM_READY",
      providerAcceptedAt: new Date(),
      metadata:
        payload.mode === "iframe" && payload.iframeToken && payload.iframeUrl
          ? ({
              ...(payment.metadata as Record<string, unknown> | null),
              paytrIframe: {
                token: payload.iframeToken,
                url: payload.iframeUrl,
              },
            } as Prisma.InputJsonValue)
          : (payment.metadata as Prisma.InputJsonValue | undefined),
    },
  });

  return { ...payload, paymentId: payment.id };
}

async function upsertPaymentMethodFromCallback(
  tx: Tx,
  input: {
    companyId: string;
    externalUserToken?: string;
    externalCardToken?: string;
    consentVersion?: string;
    consentIp?: string | null;
    metadata?: {
      maskedPan?: string;
      lastFour?: string;
      cardBrand?: string;
      cardFamily?: string;
      bankName?: string;
      expiryMonth?: number;
      expiryYear?: number;
    };
  }
) {
  if (!input.externalUserToken || !input.externalCardToken) return null;

  const fingerprint = fingerprintPaymentToken(
    `${input.externalUserToken}:${input.externalCardToken}`
  );

  const existing = await tx.companyPaymentMethod.findUnique({
    where: {
      companyId_externalTokenFingerprint: {
        companyId: input.companyId,
        externalTokenFingerprint: fingerprint,
      },
    },
  });

  if (existing) return existing;

  const hasDefault = await tx.companyPaymentMethod.findFirst({
    where: { companyId: input.companyId, isDefault: true, status: "ACTIVE" },
    select: { id: true },
  });

  return tx.companyPaymentMethod.create({
    data: {
      companyId: input.companyId,
      provider: "PAYTR",
      externalUserTokenEncrypted: encryptPaymentToken(input.externalUserToken),
      externalCardTokenEncrypted: encryptPaymentToken(input.externalCardToken),
      externalTokenFingerprint: fingerprint,
      isDefault: !hasDefault,
      consentVersion: input.consentVersion ?? "paytr-card-storage-v1",
      consentTextSnapshot: "PayTR kart saklama ve otomatik yenileme açık rızası.",
      consentAt: new Date(),
      consentIp: input.consentIp ?? undefined,
      maskedPan: input.metadata?.maskedPan,
      lastFour: input.metadata?.lastFour,
      cardBrand: input.metadata?.cardBrand,
      cardFamily: input.metadata?.cardFamily,
      bankName: input.metadata?.bankName,
      expiryMonth: input.metadata?.expiryMonth,
      expiryYear: input.metadata?.expiryYear,
      providerCreatedAt: new Date(),
    },
  });
}

export async function processPaytrCallback(payload: Record<string, string>, sourceIp?: string | null) {
  const verified = verifyPaytrCallback(payload);
  const eventKey = buildPaytrWebhookEventKey(payload);
  const payloadHash = fingerprintPaymentToken(JSON.stringify(payload));

  const result = await db.$transaction(async (tx) => {
    const payment = await tx.membershipPayment.findUnique({
      where: { merchantOid: verified.merchantOid },
      include: { plan: true, company: true },
    });

    const existingEvent = await tx.paymentWebhookEvent.findUnique({
      where: { eventKey },
    });

    if (existingEvent?.processingStatus === "PROCESSED") {
      return { duplicate: true, payment };
    }

    const event = existingEvent
      ? await tx.paymentWebhookEvent.update({
          where: { id: existingEvent.id },
          data: {
            processingStatus: "PROCESSING",
            attemptCount: { increment: 1 },
            processingStartedAt: new Date(),
          },
        })
      : await tx.paymentWebhookEvent.create({
          data: {
            provider: "PAYTR",
            eventKey,
            merchantOid: verified.merchantOid,
            paymentId: payment?.id,
            payloadHash,
            rawPayload: payload as Prisma.InputJsonValue,
            signatureValid: true,
            processingStatus: "PROCESSING",
            sourceIp: sourceIp ?? undefined,
            processingStartedAt: new Date(),
          },
        });

    if (!payment) {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "FAILED",
          lastError: "merchant_oid için ödeme bulunamadı",
        },
      });
      throw new Error("PayTR callback merchant_oid bilinmiyor.");
    }

    if (payment.amountMinor !== verified.totalAmountMinor) {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "FAILED",
          lastError: "Tutar uyuşmazlığı",
        },
      });
      throw new Error("PayTR callback tutarı local ödeme tutarıyla uyuşmuyor.");
    }

    if (normalizeCurrency(payment.currency) !== normalizeCurrency(verified.currency)) {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "FAILED",
          lastError: "Para birimi uyuşmazlığı",
        },
      });
      throw new Error("PayTR callback para birimi uyuşmuyor.");
    }

    if (payment.testMode !== verified.testMode) {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "FAILED",
          lastError: "Test modu uyuşmazlığı",
        },
      });
      throw new Error("PayTR callback test modu local ödeme kaydıyla uyuşmuyor.");
    }

    if (payment.status === "PAID") {
      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "PROCESSED",
          processedAt: new Date(),
        },
      });
      return { duplicate: true, payment };
    }

    if (verified.status === "failed") {
      assertPaymentTransition(payment.status, "FAILED");
      const failed = await tx.membershipPayment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          providerStatus: verified.providerStatus,
          providerPaymentId: verified.providerPaymentId,
          failedReasonCode: verified.failedReasonCode,
          failedReasonMessage: verified.failedReasonMessage?.slice(0, 500),
          failedAt: new Date(),
          callbackReceivedAt: new Date(),
        },
      });

      await releaseDiscountRedemptions(payment.id, tx);

      await enqueueBillingOutboxEvent({
        companyId: payment.companyId,
        type: "PAYMENT_FAILED",
        aggregateType: "MembershipPayment",
        aggregateId: payment.id,
        payload: { paymentId: payment.id, merchantOid: payment.merchantOid },
      }, tx);

      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { processingStatus: "PROCESSED", processedAt: new Date() },
      });

      return { duplicate: false, payment: failed };
    }

    const statusBeforePaid = await applyStatusStepsBeforePaid(
      tx,
      payment.id,
      payment.status
    );
    assertPaymentTransition(statusBeforePaid, "PAID");
    const paytrCapabilities = getPaytrCapabilities();
    const autoRenew = resolveAutoRenewFromPaymentMetadata(
      paytrCapabilities,
      payment.metadata as { autoRenew?: boolean; saveCard?: boolean } | null
    );
    const paymentMethod =
      paytrCapabilities.cardStorageAvailable &&
      Boolean(
        (payment.metadata as { saveCard?: boolean } | null)?.saveCard &&
          verified.externalUserToken &&
          verified.externalCardToken
      )
        ? await upsertPaymentMethodFromCallback(tx, {
            companyId: payment.companyId,
            externalUserToken: verified.externalUserToken,
            externalCardToken: verified.externalCardToken,
            consentIp: payment.payerIp,
            metadata: verified.cardMetadata,
          })
        : null;

    const paidAt = new Date();
    const paid = await tx.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt,
        callbackReceivedAt: paidAt,
        providerPaymentId: verified.providerPaymentId,
        providerStatus: verified.providerStatus,
        paymentMethodId: paymentMethod?.id,
      },
    });

    const paymentType = payment.type;
    const isAddOnPayment =
      paymentType === "ADD_ON" ||
      paymentType === "ADD_ON_PURCHASE" ||
      paymentType === "ADD_ON_RENEWAL" ||
      paymentType === "USAGE_PACK_PURCHASE";

    if (isAddOnPayment) {
      await activateAddOnAfterPayment(
        {
          id: payment.id,
          companyId: payment.companyId,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          metadata: payment.metadata,
          priceSnapshot: payment.priceSnapshot,
        },
        tx
      );

      const paid = await tx.membershipPayment.update({
        where: { id: payment.id },
        data: {
          status: "PAID",
          paidAt,
          callbackReceivedAt: paidAt,
          providerPaymentId: verified.providerPaymentId,
          providerStatus: verified.providerStatus,
          paymentMethodId: paymentMethod?.id,
        },
      });

      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { processingStatus: "PROCESSED", processedAt: new Date() },
      });

      return { duplicate: false, payment: paid };
    }

    const updatedSubscription = await tx.companySubscription.upsert({
      where: { companyId: payment.companyId },
      create: {
        companyId: payment.companyId,
        planId: payment.planId,
        status: "ACTIVE",
        currentPeriodStart: payment.periodStart,
        currentPeriodEnd: payment.periodEnd,
        nextBillingAt: nextBillingDate(payment.periodEnd, autoRenew),
        trialEndsAt: null,
        autoRenew,
        defaultPaymentMethodId: paymentMethod?.id,
        lastPaymentId: payment.id,
        lastSuccessfulPaymentId: payment.id,
        failedPaymentCount: 0,
        billingInterval: payment.period ?? undefined,
      },
      update: {
        planId: payment.planId ?? undefined,
        status: "ACTIVE",
        currentPeriodStart: payment.periodStart,
        currentPeriodEnd: payment.periodEnd,
        nextBillingAt: nextBillingDate(payment.periodEnd, autoRenew),
        graceEndsAt: null,
        trialEndsAt: null,
        autoRenew,
        defaultPaymentMethodId: paymentMethod?.id ?? undefined,
        lastPaymentId: payment.id,
        lastSuccessfulPaymentId: payment.id,
        failedPaymentCount: 0,
        billingInterval: payment.period ?? undefined,
      },
    });

    if (payment.subscriptionId) {
      await applyPendingChangeAfterSuccessfulPayment(
        {
          subscriptionId: payment.subscriptionId,
          companyId: payment.companyId,
          paymentId: payment.id,
        },
        tx
      );
    }

    await syncLegacyMembershipSettings(
      payment.companyId,
      {
        subscription: updatedSubscription,
        lastPaymentDate: paidAt,
        monthlyFeeMinor: payment.amountMinor,
      },
      tx
    );

    await finalizeDiscountRedemptions(payment.id, tx);

    await tx.activityLog.create({
      data: {
        companyId: payment.companyId,
        userId: payment.initiatedByUserId,
        action: "UPDATE",
        module: "settings",
        message: `PayTR üyelik ödemesi onaylandı: ${payment.merchantOid}`,
      },
    });

    await enqueueBillingOutboxEvent({
      companyId: payment.companyId,
      type: "PAYMENT_SUCCEEDED",
      aggregateType: "MembershipPayment",
      aggregateId: payment.id,
      payload: { paymentId: payment.id, merchantOid: payment.merchantOid },
    }, tx);

    await tx.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });

    return { duplicate: false, payment: paid };
  });

  if (!result.duplicate && result.payment?.status === "PAID" && !result.payment.testMode) {
    await createPartnerPaymentConversion({
      companyId: result.payment.companyId,
      paymentAmount: Number(result.payment.amount),
      membershipPaymentId: result.payment.id,
    });
  }

  return result;
}

type SyncMembershipPaymentResult = {
  payment: Awaited<ReturnType<typeof db.membershipPayment.findFirst>>;
  synced: boolean;
  status?: string;
  providerStatus?: string;
  message?: string;
};

export async function syncMembershipPaymentWithProvider(input: {
  companyId: string;
  paymentId: string;
}): Promise<SyncMembershipPaymentResult> {
  const payment = await db.membershipPayment.findFirst({
    where: { id: input.paymentId, companyId: input.companyId },
  });

  if (!payment?.merchantOid) {
    throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  const resolvedPayment = payment;

  if (payment.status === "PAID") {
    return {
      payment: resolvedPayment,
      synced: true,
      status: payment.status,
      message: "Ödeme zaten onaylanmış.",
    };
  }

  const provider = await createPaytrAdapter().queryPayment({
    merchantOid: payment.merchantOid,
  });

  if (provider.status === "UNKNOWN") {
    return {
      payment: resolvedPayment,
      synced: false,
      status: payment.status,
      providerStatus: provider.providerStatus,
      message: "PayTR henüz kesin sonuç döndürmedi. Birkaç dakika sonra tekrar deneyin.",
    };
  }

  if (provider.status === "FAILED") {
    if (payment.status !== "FAILED" && payment.status !== "CANCELLED") {
      await db.$transaction(async (tx) => {
        const fresh = await tx.membershipPayment.findUnique({ where: { id: payment.id } });
        if (!fresh || fresh.status === "FAILED" || fresh.status === "PAID") return;
        assertPaymentTransition(fresh.status, "FAILED");
        await tx.membershipPayment.update({
          where: { id: fresh.id },
          data: {
            status: "FAILED",
            providerStatus: provider.providerStatus,
            failedAt: new Date(),
          },
        });
        await releaseDiscountRedemptions(fresh.id, tx);
      });
    }

    const updated = await db.membershipPayment.findUnique({ where: { id: payment.id } });
    return {
      payment: updated ?? resolvedPayment,
      synced: true,
      status: updated?.status ?? "FAILED",
      providerStatus: provider.providerStatus,
      message: "PayTR ödemeyi başarısız olarak bildirdi.",
    };
  }

  if (provider.status !== "PAID") {
    return {
      payment: resolvedPayment,
      synced: false,
      status: payment.status,
      providerStatus: provider.providerStatus,
      message: "PayTR sonucu henüz netleşmedi.",
    };
  }

  const localAmountMinor = payment.amountMinor ?? Math.round(Number(payment.amount) * 100);
  if (provider.amountMinor != null && provider.amountMinor !== localAmountMinor) {
    throw new MembershipServiceError("PayTR tutarı kayıtla uyuşmuyor.", 409);
  }

  const result = await db.$transaction(async (tx) => {
    const fresh = await tx.membershipPayment.findUnique({
      where: { id: payment.id },
      include: { plan: true, company: true },
    });

    if (!fresh) {
      throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
    }

    if (fresh.status === "PAID") {
      return { payment: fresh, synced: true };
    }

    const statusBeforePaid = await applyStatusStepsBeforePaid(tx, fresh.id, fresh.status);
    assertPaymentTransition(statusBeforePaid, "PAID");

    const paidAt = new Date();
    const paid = await tx.membershipPayment.update({
      where: { id: fresh.id },
      data: {
        status: "PAID",
        paidAt,
        callbackReceivedAt: paidAt,
        providerStatus: provider.providerStatus,
      },
    });

    const paytrCapabilities = getPaytrCapabilities();
    const autoRenew = resolveAutoRenewFromPaymentMetadata(
      paytrCapabilities,
      fresh.metadata as { autoRenew?: boolean; saveCard?: boolean } | null
    );

    const updatedSubscription = await tx.companySubscription.upsert({
      where: { companyId: fresh.companyId },
      create: {
        companyId: fresh.companyId,
        planId: fresh.planId,
        status: "ACTIVE",
        currentPeriodStart: fresh.periodStart,
        currentPeriodEnd: fresh.periodEnd,
        nextBillingAt: nextBillingDate(fresh.periodEnd, autoRenew),
        trialEndsAt: null,
        autoRenew,
        lastPaymentId: fresh.id,
        lastSuccessfulPaymentId: fresh.id,
        failedPaymentCount: 0,
        billingInterval: fresh.period ?? undefined,
      },
      update: {
        planId: fresh.planId ?? undefined,
        status: "ACTIVE",
        currentPeriodStart: fresh.periodStart,
        currentPeriodEnd: fresh.periodEnd,
        nextBillingAt: nextBillingDate(fresh.periodEnd, autoRenew),
        graceEndsAt: null,
        trialEndsAt: null,
        autoRenew,
        lastPaymentId: fresh.id,
        lastSuccessfulPaymentId: fresh.id,
        failedPaymentCount: 0,
        billingInterval: fresh.period ?? undefined,
      },
    });

    if (fresh.subscriptionId) {
      await applyPendingChangeAfterSuccessfulPayment(
        {
          subscriptionId: fresh.subscriptionId,
          companyId: fresh.companyId,
          paymentId: fresh.id,
        },
        tx
      );
    }

    await syncLegacyMembershipSettings(
      fresh.companyId,
      {
        subscription: updatedSubscription,
        lastPaymentDate: paidAt,
        monthlyFeeMinor: fresh.amountMinor,
      },
      tx
    );

    await finalizeDiscountRedemptions(fresh.id, tx);

    await tx.activityLog.create({
      data: {
        companyId: fresh.companyId,
        userId: fresh.initiatedByUserId,
        action: "UPDATE",
        module: "settings",
        message: `PayTR ödeme mutabakatı ile onaylandı: ${fresh.merchantOid}`,
      },
    });

    await enqueueBillingOutboxEvent(
      {
        companyId: fresh.companyId,
        type: "PAYMENT_SUCCEEDED",
        aggregateType: "MembershipPayment",
        aggregateId: fresh.id,
        payload: { paymentId: fresh.id, merchantOid: fresh.merchantOid },
      },
      tx
    );

    return { payment: paid, synced: true as const };
  });

  if (result.payment?.status === "PAID" && !result.payment.testMode) {
    await createPartnerPaymentConversion({
      companyId: result.payment.companyId,
      paymentAmount: Number(result.payment.amount),
      membershipPaymentId: result.payment.id,
    });
  }

  return {
    payment: result.payment,
    synced: true,
    status: result.payment?.status,
    providerStatus: provider.providerStatus,
    message: "Ödeme PayTR üzerinden doğrulandı ve üyelik aktif edildi.",
  };
}
