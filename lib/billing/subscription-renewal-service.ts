import "server-only";

import { db } from "@/lib/prisma";
import {
  calculateGraceEndsAt,
  calculateNextRetryAt,
} from "@/lib/billing/billing-retry-policy";
import { generatePaytrMerchantOid } from "@/lib/payments/merchant-oid";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import { decryptPaymentToken } from "@/lib/payments/payment-token-crypto";
import { periodMonths } from "@/lib/billing/billing-period-utils";
import { addBillingPeriod } from "@/lib/billing/pricing-utils";
import { resolveSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import { resolveRenewalTarget } from "@/lib/billing/subscription-pending-change-service";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { getPaytrCapabilities } from "@/lib/payments/paytr-capabilities";
import type { MembershipPeriod, Prisma } from "@prisma/client";

const MAX_RENEWAL_ATTEMPTS = 5;

async function buildRenewalPricing(input: {
  companyId: string;
  planId: string;
  billingInterval: MembershipPeriod;
}) {
  const resolved = await resolveSubscriptionPrice({
    companyId: input.companyId,
    planId: input.planId,
    billingInterval: input.billingInterval,
    isRenewal: true,
  });

  const snapshot = {
    planId: resolved.planId,
    planPriceId: resolved.planPriceId,
    priceVersion: resolved.priceVersion,
    planNameSnapshot: resolved.planName,
    billingPeriodSnapshot: resolved.billingInterval,
    periodMonthsSnapshot: periodMonths(resolved.billingInterval),
    listPriceMinor: resolved.listPriceMinor,
    basePriceMinor: resolved.salePriceMinor,
    discountMinor: resolved.discountMinor,
    subtotalMinor: resolved.subtotalMinor,
    vatRateSnapshot: resolved.vatRate,
    vatMinor: resolved.vatMinor,
    totalMinor: resolved.totalMinor,
    currency: resolved.currency,
    appliedDiscounts: resolved.appliedDiscounts,
    priceSource: resolved.priceSource,
    planEntitlementsSnapshot: resolved.entitlementsSnapshot,
  };

  return { resolved, snapshot };
}

function renewalPaymentData(input: {
  companyId: string;
  planId: string;
  subscriptionId: string;
  merchantOid: string;
  periodStart: Date;
  periodEnd: Date;
  billingInterval: MembershipPeriod;
  snapshot: Awaited<ReturnType<typeof buildRenewalPricing>>["snapshot"];
  currency: string;
  testMode: boolean;
}): Prisma.MembershipPaymentUncheckedCreateInput {
  return {
    companyId: input.companyId,
    planId: input.planId,
    planPriceId:
      input.snapshot.planPriceId.startsWith("legacy-") ||
      input.snapshot.planPriceId === "grandfathered"
        ? null
        : input.snapshot.planPriceId,
    period: input.billingInterval,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    amount: input.snapshot.totalMinor / 100,
    currency: input.currency,
    status: "PENDING",
    paymentMethod: "PAYTR",
    type: "SUBSCRIPTION_RENEWAL",
    providerEnum: "PAYTR",
    provider: "PayTR",
    merchantOid: input.merchantOid,
    subscriptionId: input.subscriptionId,
    amountMinor: input.snapshot.totalMinor,
    subtotalMinor: input.snapshot.subtotalMinor,
    vatMinor: input.snapshot.vatMinor,
    discountMinor: input.snapshot.discountMinor,
    planNameSnapshot: input.snapshot.planNameSnapshot,
    billingPeriodSnapshot: input.snapshot.billingPeriodSnapshot,
    periodMonthsSnapshot: input.snapshot.periodMonthsSnapshot,
    priceSnapshot: input.snapshot as Prisma.InputJsonValue,
    planEntitlementsSnapshot: input.snapshot.planEntitlementsSnapshot as Prisma.InputJsonValue,
    testMode: input.testMode,
  };
}

export async function runBillingRenewals(referenceDate = new Date()) {
  const paytrCapabilities = getPaytrCapabilities();

  if (!paytrCapabilities.autoRenewAvailable) {
    const suspended = await suspendExpiredGraceSubscriptions(referenceDate);
    return {
      checked: 0,
      charged: 0,
      skipped: 0,
      unknown: 0,
      autoRenewEnabled: false,
      reason:
        "PayTR otomatik yenileme kapalı: Direct API + kart saklama + recurring + non-3D gerekir.",
      retries: { checked: 0, attempted: 0, skipped: 0, unknown: 0 },
      suspended,
    };
  }

  const retrySummary = await runFailedBillingRetries(referenceDate);
  const suspended = await suspendExpiredGraceSubscriptions(referenceDate);
  const dueSubscriptions = await db.companySubscription.findMany({
    where: {
      autoRenew: true,
      nextBillingAt: { lte: referenceDate },
      status: { in: ["ACTIVE", "PAST_DUE", "GRACE_PERIOD"] },
      defaultPaymentMethodId: { not: null },
    },
    include: {
      plan: true,
      company: true,
      defaultPaymentMethod: true,
    },
    take: 50,
  });

  let charged = 0;
  let skipped = 0;
  let unknown = 0;

  for (const subscription of dueSubscriptions) {
    if (!subscription.plan || !subscription.defaultPaymentMethod || !subscription.currentPeriodEnd) {
      skipped += 1;
      continue;
    }

    const renewalTarget = await resolveRenewalTarget(subscription, referenceDate);
    if (!renewalTarget) {
      skipped += 1;
      continue;
    }

    const billingInterval = renewalTarget.billingInterval;
    const planId = renewalTarget.planId;
    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = addBillingPeriod(periodStart, billingInterval);

    const run = await db.subscriptionBillingRun.upsert({
      where: {
        subscriptionId_periodStart: {
          subscriptionId: subscription.id,
          periodStart,
        },
      },
      create: {
        companyId: subscription.companyId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        scheduledAt: referenceDate,
        status: "CREATED",
        attemptNo: subscription.failedPaymentCount + 1,
      },
      update: {},
    });

    if (run.status !== "CREATED") {
      skipped += 1;
      continue;
    }

    const { snapshot } = await buildRenewalPricing({
      companyId: subscription.companyId,
      planId,
      billingInterval,
    });
    const amountMinor = snapshot.totalMinor;
    const merchantOid = generatePaytrMerchantOid();
    const payment = await db.membershipPayment.create({
      data: renewalPaymentData({
        companyId: subscription.companyId,
        planId,
        subscriptionId: subscription.id,
        merchantOid,
        periodStart,
        periodEnd,
        billingInterval,
        snapshot,
        currency: subscription.plan.currency,
        testMode: process.env.PAYTR_TEST_MODE === "1",
      }),
    });

    await db.subscriptionBillingRun.update({
      where: { id: run.id },
      data: { paymentId: payment.id, status: "PROCESSING", processingStartedAt: new Date() },
    });

    const result = await createPaytrAdapter().chargeSavedCard({
      merchantOid,
      amountMinor,
      currency: subscription.plan.currency,
      payerEmail: subscription.company.email ?? "billing@hesapisleri.com",
      payerIp: "127.0.0.1",
      externalUserToken: decryptPaymentToken(subscription.defaultPaymentMethod.externalUserTokenEncrypted),
      externalCardToken: decryptPaymentToken(subscription.defaultPaymentMethod.externalCardTokenEncrypted),
      testMode: payment.testMode,
    });

    if (result.status === "failed") {
      await db.$transaction(async (tx) => {
        await tx.membershipPayment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            providerStatus: result.providerStatus,
            failedReasonCode: result.providerErrorCode,
            failedReasonMessage: result.providerErrorMessage,
            failedAt: new Date(),
          },
        });
        await tx.subscriptionBillingRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            nextRetryAt: calculateNextRetryAt(run.attemptNo),
            errorCode: result.providerErrorCode,
            errorMessage: result.providerErrorMessage,
          },
        });
        const graceEndsAt = subscription.graceEndsAt ?? calculateGraceEndsAt(referenceDate);
        await tx.companySubscription.update({
          where: { id: subscription.id },
          data: {
            status: "PAST_DUE",
            graceEndsAt,
            failedPaymentCount: { increment: 1 },
            lastPaymentFailureAt: new Date(),
            lastPaymentAttemptAt: new Date(),
          },
        });
        await enqueueBillingOutboxEvent({
          companyId: subscription.companyId,
          type: "SUBSCRIPTION_PAST_DUE",
          aggregateType: "CompanySubscription",
          aggregateId: subscription.id,
          payload: {
            paymentId: payment.id,
            billingRunId: run.id,
            nextRetryAt: calculateNextRetryAt(run.attemptNo),
            graceEndsAt,
          },
        }, tx);
      });
      continue;
    }

    if (result.status === "unknown") {
      unknown += 1;
      await db.membershipPayment.update({
        where: { id: payment.id },
        data: { status: "UNKNOWN", providerStatus: result.providerStatus },
      });
      await db.subscriptionBillingRun.update({
        where: { id: run.id },
        data: { status: "UNKNOWN", errorCode: "PAYTR_TIMEOUT" },
      });
      continue;
    }

    charged += 1;
    await db.subscriptionBillingRun.update({
      where: { id: run.id },
      data: { status: "WAIT_CALLBACK" },
    });
    await db.membershipPayment.update({
      where: { id: payment.id },
      data: { status: "WAIT_CALLBACK", providerStatus: result.providerStatus },
    });
  }

  return {
    checked: dueSubscriptions.length,
    charged,
    skipped,
    unknown,
    autoRenewEnabled: true,
    retries: retrySummary,
    suspended,
  };
}

async function runFailedBillingRetries(referenceDate: Date) {
  const retryRuns = await db.subscriptionBillingRun.findMany({
    where: {
      status: "FAILED",
      nextRetryAt: { lte: referenceDate },
      attemptNo: { lt: MAX_RENEWAL_ATTEMPTS },
    },
    include: {
      subscription: {
        include: {
          company: true,
          plan: true,
          defaultPaymentMethod: true,
        },
      },
    },
    take: 50,
  });

  let attempted = 0;
  let skipped = 0;
  let unknown = 0;

  for (const run of retryRuns) {
    const subscription = run.subscription;
    if (!subscription.plan || !subscription.defaultPaymentMethod) {
      skipped += 1;
      continue;
    }

    const blockingPayment = await db.membershipPayment.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: { in: ["WAIT_CALLBACK", "UNKNOWN", "PENDING"] },
      },
    });
    if (blockingPayment) {
      skipped += 1;
      continue;
    }

    attempted += 1;
    const renewalTarget = await resolveRenewalTarget(subscription, referenceDate);
    if (!renewalTarget) {
      skipped += 1;
      continue;
    }
    const billingInterval = renewalTarget.billingInterval;
    const planId = renewalTarget.planId;
    const { snapshot } = await buildRenewalPricing({
      companyId: subscription.companyId,
      planId,
      billingInterval,
    });
    const amountMinor = snapshot.totalMinor;
    const merchantOid = generatePaytrMerchantOid();
    const payment = await db.membershipPayment.create({
      data: renewalPaymentData({
        companyId: subscription.companyId,
        planId,
        subscriptionId: subscription.id,
        merchantOid,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        billingInterval,
        snapshot,
        currency: subscription.plan.currency,
        testMode: process.env.PAYTR_TEST_MODE === "1",
      }),
    });

    await db.subscriptionBillingRun.update({
      where: { id: run.id },
      data: {
        paymentId: payment.id,
        status: "PROCESSING",
        attemptNo: { increment: 1 },
        processingStartedAt: new Date(),
        nextRetryAt: null,
      },
    });

    const result = await createPaytrAdapter().chargeSavedCard({
      merchantOid,
      amountMinor,
      currency: subscription.plan.currency,
      payerEmail: subscription.company.email ?? "billing@hesapisleri.com",
      payerIp: "127.0.0.1",
      externalUserToken: decryptPaymentToken(subscription.defaultPaymentMethod.externalUserTokenEncrypted),
      externalCardToken: decryptPaymentToken(subscription.defaultPaymentMethod.externalCardTokenEncrypted),
      testMode: payment.testMode,
    });

    if (result.status === "failed") {
      await db.$transaction(async (tx) => {
        const nextRetryAt = calculateNextRetryAt(run.attemptNo + 1);
        await tx.membershipPayment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            providerStatus: result.providerStatus,
            failedReasonCode: result.providerErrorCode,
            failedReasonMessage: result.providerErrorMessage,
            failedAt: new Date(),
          },
        });
        await tx.subscriptionBillingRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            nextRetryAt,
            errorCode: result.providerErrorCode,
            errorMessage: result.providerErrorMessage,
          },
        });
        await tx.companySubscription.update({
          where: { id: subscription.id },
          data: {
            status: nextRetryAt ? "PAST_DUE" : "SUSPENDED",
            failedPaymentCount: { increment: 1 },
            lastPaymentFailureAt: new Date(),
            lastPaymentAttemptAt: new Date(),
          },
        });
      });
      continue;
    }

    if (result.status === "unknown") {
      unknown += 1;
      await db.membershipPayment.update({
        where: { id: payment.id },
        data: { status: "UNKNOWN", providerStatus: result.providerStatus },
      });
      await db.subscriptionBillingRun.update({
        where: { id: run.id },
        data: { status: "UNKNOWN", errorCode: "PAYTR_TIMEOUT" },
      });
      continue;
    }

    await db.membershipPayment.update({
      where: { id: payment.id },
      data: { status: "WAIT_CALLBACK", providerStatus: result.providerStatus },
    });
    await db.subscriptionBillingRun.update({
      where: { id: run.id },
      data: { status: "WAIT_CALLBACK" },
    });
  }

  return { checked: retryRuns.length, attempted, skipped, unknown };
}

async function suspendExpiredGraceSubscriptions(referenceDate: Date) {
  const expired = await db.companySubscription.findMany({
    where: {
      status: { in: ["PAST_DUE", "GRACE_PERIOD"] },
      graceEndsAt: { lt: referenceDate },
    },
    select: { id: true, companyId: true },
    take: 100,
  });

  for (const subscription of expired) {
    await db.$transaction(async (tx) => {
      await tx.companySubscription.update({
        where: { id: subscription.id },
        data: { status: "SUSPENDED" },
      });
      await enqueueBillingOutboxEvent({
        companyId: subscription.companyId,
        type: "SUBSCRIPTION_SUSPENDED",
        aggregateType: "CompanySubscription",
        aggregateId: subscription.id,
        payload: { graceExpiredAt: referenceDate.toISOString() },
      }, tx);
    });
  }

  return expired.length;
}
