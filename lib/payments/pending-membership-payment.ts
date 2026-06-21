import "server-only";

import type { MembershipPayment, MembershipPaymentStatus, MembershipPeriod } from "@prisma/client";
import { db } from "@/lib/prisma";
import { MembershipServiceError } from "@/lib/membership-service";
import { releaseDiscountRedemptions } from "@/lib/billing/discount-reservation-service";
import { assertPaymentTransition } from "@/lib/payments/payment-state-machine";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import { getPaytrConfig } from "@/lib/payments/providers/paytr/paytr-config";

export const PENDING_MEMBERSHIP_PAYMENT_STATUSES = [
  "CREATED",
  "FORM_READY",
  "PENDING",
  "WAIT_CALLBACK",
  "UNKNOWN",
] as const;

export const RESUMABLE_MEMBERSHIP_PAYMENT_STATUSES = ["CREATED", "FORM_READY"] as const;

export const BLOCKING_MEMBERSHIP_PAYMENT_STATUSES = [
  "PENDING",
  "WAIT_CALLBACK",
  "UNKNOWN",
] as const;

const STALE_PENDING_MS = 30 * 60 * 1000;

function isResumableStatus(status: MembershipPaymentStatus) {
  return (RESUMABLE_MEMBERSHIP_PAYMENT_STATUSES as readonly MembershipPaymentStatus[]).includes(
    status
  );
}

function isBlockingStatus(status: MembershipPaymentStatus) {
  return (BLOCKING_MEMBERSHIP_PAYMENT_STATUSES as readonly MembershipPaymentStatus[]).includes(
    status
  );
}

type PaymentMetadata = {
  autoRenew?: boolean;
  saveCard?: boolean;
  consentVersion?: string;
  couponCode?: string | null;
  paytrIframe?: {
    token: string;
    url: string;
  };
};

function readPaytrIframeFromMetadata(payment: MembershipPayment) {
  const metadata = (payment.metadata as PaymentMetadata | null) ?? {};
  return metadata.paytrIframe ?? null;
}

async function persistPaytrIframeMetadata(
  payment: MembershipPayment,
  payload: {
    mode?: "iframe" | "direct";
    iframeToken?: string;
    iframeUrl?: string;
  }
) {
  if (payload.mode !== "iframe" || !payload.iframeToken || !payload.iframeUrl) {
    return;
  }

  const metadata = (payment.metadata as PaymentMetadata | null) ?? {};
  await db.membershipPayment.update({
    where: { id: payment.id },
    data: {
      metadata: {
        ...metadata,
        paytrIframe: {
          token: payload.iframeToken,
          url: payload.iframeUrl,
        },
      },
    },
  });
}

function buildCachedIframePayload(payment: MembershipPayment) {
  const cached = readPaytrIframeFromMetadata(payment);
  if (!cached || !payment.merchantOid) return null;

  return {
    paymentId: payment.id,
    merchantOid: payment.merchantOid,
    mode: "iframe" as const,
    iframeToken: cached.token,
    iframeUrl: cached.url,
    resumed: true as const,
  };
}

export async function findPendingMembershipPayment(companyId: string) {
  return db.membershipPayment.findFirst({
    where: {
      companyId,
      status: { in: [...PENDING_MEMBERSHIP_PAYMENT_STATUSES] },
      provider: { not: "TRIAL" },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function expireStalePendingMembershipPayments(companyId: string) {
  const cutoff = new Date(Date.now() - STALE_PENDING_MS);
  const stale = await db.membershipPayment.findMany({
    where: {
      companyId,
      status: { in: [...RESUMABLE_MEMBERSHIP_PAYMENT_STATUSES] },
      provider: { not: "TRIAL" },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });

  for (const payment of stale) {
    try {
      await cancelMembershipPayment({ companyId, paymentId: payment.id });
    } catch {
      // Best-effort cleanup; a concurrent callback may have advanced the payment.
    }
  }
}

export async function cancelMembershipPayment(input: {
  companyId: string;
  paymentId: string;
}) {
  const payment = await db.membershipPayment.findFirst({
    where: { id: input.paymentId, companyId: input.companyId },
  });

  if (!payment) {
    throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  if (payment.status === "CANCELLED") {
    return payment;
  }

  if (payment.status === "PAID" || payment.status === "REFUNDED") {
    throw new MembershipServiceError("Tamamlanmış ödeme iptal edilemez.", 400);
  }

  if (isBlockingStatus(payment.status)) {
    throw new MembershipServiceError(
      "Banka onayı bekleyen ödeme iptal edilemez. Lütfen birkaç dakika bekleyin.",
      409
    );
  }

  if (!isResumableStatus(payment.status) && payment.status !== "FAILED") {
    throw new MembershipServiceError("Bu ödeme iptal edilemez.", 400);
  }

  assertPaymentTransition(payment.status, "CANCELLED");

  return db.$transaction(async (tx) => {
    const cancelled = await tx.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
        note: payment.note ?? "Kullanıcı tarafından iptal edildi.",
      },
    });

    await releaseDiscountRedemptions(payment.id, tx);
    return cancelled;
  });
}

function paymentMatchesInitializeRequest(
  payment: MembershipPayment,
  input: {
    planId: string;
    period: MembershipPeriod;
    couponCode?: string | null;
  }
) {
  const metadata = (payment.metadata as PaymentMetadata | null) ?? {};
  const paymentCoupon = metadata.couponCode?.trim().toUpperCase() ?? "";
  const requestCoupon = input.couponCode?.trim().toUpperCase() ?? "";

  return (
    payment.planId === input.planId &&
    payment.period === input.period &&
    paymentCoupon === requestCoupon
  );
}

export async function buildPaytrFormForMembershipPayment(
  payment: MembershipPayment,
  payerIp: string
) {
  const config = getPaytrConfig();

  if (config.integrationMode === "direct" && !config.directApiEnabled) {
    throw new MembershipServiceError(
      "PayTR Direkt API kapalı. PAYTR_DIRECT_API_ENABLED=true veya PAYTR_INTEGRATION_MODE=iframe kullanın.",
      503
    );
  }

  if (!payment.merchantOid || payment.amountMinor == null) {
    throw new MembershipServiceError("Ödeme kaydı PayTR için hazır değil.", 400);
  }

  const cachedIframe = buildCachedIframePayload(payment);
  if (cachedIframe) {
    await db.membershipPayment.update({
      where: { id: payment.id },
      data: { payerIp },
    });
    return cachedIframe;
  }

  const metadata = (payment.metadata as PaymentMetadata | null) ?? {};
  const saveCard = metadata.saveCard ?? false;
  const planName =
    payment.planNameSnapshot ??
    (payment.planId
      ? (await db.membershipPlan.findUnique({ where: { id: payment.planId }, select: { name: true } }))
          ?.name
      : null) ??
    "Üyelik";

  const adapter = createPaytrAdapter();
  let payload;
  try {
    payload = await adapter.createInitialPayment({
      merchantOid: payment.merchantOid,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      payerEmail: payment.payerEmail ?? "billing@hesapisleri.com",
      payerName: payment.payerName ?? "Müşteri",
      payerPhone: payment.payerPhone ?? "0000000000",
      payerIp,
      okUrl: `${config.okUrl}?paymentId=${payment.id}`,
      failUrl: `${config.failUrl}?paymentId=${payment.id}`,
      basket: [
        {
          name: `${planName} - ${payment.period ?? "YEARLY"}`,
          amountMinor: payment.amountMinor,
          quantity: 1,
        },
      ],
      saveCard,
      testMode: payment.testMode ?? config.testMode,
    });
  } catch (error) {
    throw new MembershipServiceError(
      error instanceof Error
        ? error.message
        : "PayTR ödeme formu yeniden oluşturulamadı.",
      502
    );
  }

  await persistPaytrIframeMetadata(payment, payload);

  if (payment.status === "CREATED") {
    assertPaymentTransition(payment.status, "FORM_READY");
    await db.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: "FORM_READY",
        payerIp,
        providerAcceptedAt: new Date(),
      },
    });
  } else {
    await db.membershipPayment.update({
      where: { id: payment.id },
      data: { payerIp },
    });
  }

  return { ...payload, paymentId: payment.id, resumed: true as const };
}

export async function resumePaytrMembershipPayment(input: {
  companyId: string;
  paymentId: string;
  payerIp: string;
}) {
  const payment = await db.membershipPayment.findFirst({
    where: { id: input.paymentId, companyId: input.companyId },
  });

  if (!payment) {
    throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
  }

  if (!isResumableStatus(payment.status)) {
    throw new MembershipServiceError(
      "Bu ödeme devam ettirilemez. Yeni bir ödeme başlatın.",
      409
    );
  }

  return buildPaytrFormForMembershipPayment(payment, input.payerIp);
}

export async function resolvePendingForInitialize(input: {
  companyId: string;
  planId: string;
  period: MembershipPeriod;
  couponCode?: string | null;
  forceNew?: boolean;
}) {
  await expireStalePendingMembershipPayments(input.companyId);

  const pending = await findPendingMembershipPayment(input.companyId);
  if (!pending) {
    return { pending: null as null, resume: false as const };
  }

  if (isBlockingStatus(pending.status)) {
    throw new MembershipServiceError(
      "Devam eden bir ödeme işlemi var. Lütfen önce mevcut işlemin sonucunu bekleyin.",
      409
    );
  }

  if (!isResumableStatus(pending.status)) {
    throw new MembershipServiceError(
      "Devam eden bir ödeme işlemi var. Lütfen önce mevcut işlemin sonucunu bekleyin.",
      409
    );
  }

  if (
    input.forceNew ||
    !paymentMatchesInitializeRequest(pending, {
      planId: input.planId,
      period: input.period,
      couponCode: input.couponCode,
    })
  ) {
    await cancelMembershipPayment({
      companyId: input.companyId,
      paymentId: pending.id,
    });
    return { pending: null as null, resume: false as const };
  }

  return { pending, resume: true as const };
}
