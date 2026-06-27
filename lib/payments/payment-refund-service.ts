import "server-only";

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { restoreDiscountRedemptionsOnRefund } from "@/lib/billing/discount-refund-service";
import { logAdminPaymentAudit } from "@/lib/admin/payments/admin-payment-audit";
import { invalidateAdminPaymentCaches } from "@/lib/admin/payments/admin-payment-cache";
import { sumCompletedRefundsMinor } from "@/lib/admin/payments/admin-payment-refund-utils";
import {
  assertRefundStateTransition,
  PaymentRefundValidationError,
  resolveRefundPaymentStatus,
  toRefundRowInput,
  validateRefundPaymentEligibility,
  validateRefundReason,
  validateRefundRequestAmount,
  type RefundPaymentSnapshot,
} from "@/lib/payments/payment-refund-core";
import { redactProviderRefundResponse } from "@/lib/payments/payment-refund-redaction";

export { PaymentRefundValidationError };

function generateRefundReferenceNo() {
  return `RF${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${randomBytes(5).toString("hex").toUpperCase()}`;
}

export type RefundMembershipPaymentInput = {
  paymentId: string;
  amountMinor: number;
  reason: string;
  requestedByUserId: string;
  idempotencyKey?: string;
};

export type RefundMembershipPaymentResult = {
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  refundId: string;
  referenceNo: string;
  paymentStatus?: string;
  refundedAmountMinor?: number;
};

async function logRefundAudit(input: {
  actorUserId: string;
  payment: RefundPaymentSnapshot;
  action: "PAYMENT_REFUND_REQUESTED" | "PAYMENT_REFUND_COMPLETED" | "PAYMENT_REFUND_FAILED";
  refundId?: string;
  amountMinor?: number;
  metadata?: Record<string, unknown>;
}) {
  await logAdminPaymentAudit({
    actorUserId: input.actorUserId,
    paymentId: input.payment.id,
    companyId: input.payment.companyId,
    subscriptionId: input.payment.subscriptionId,
    action: input.action,
    metadata: {
      refundId: input.refundId,
      amountMinor: input.amountMinor,
      ...input.metadata,
    },
  });
}

export async function refundMembershipPayment(
  input: RefundMembershipPaymentInput
): Promise<RefundMembershipPaymentResult> {
  validateRefundReason(input.reason);

  const payment = await db.membershipPayment.findUnique({
    where: { id: input.paymentId },
    include: {
      refunds: {
        select: {
          id: true,
          status: true,
          amountMinor: true,
          currency: true,
          completedAt: true,
          referenceNo: true,
        },
      },
    },
  });

  if (!payment) {
    throw new PaymentRefundValidationError("Ödeme kaydı bulunamadı.", "NOT_FOUND", 404);
  }

  const snapshot: RefundPaymentSnapshot = {
    id: payment.id,
    companyId: payment.companyId,
    subscriptionId: payment.subscriptionId,
    status: payment.status,
    providerEnum: payment.providerEnum,
    merchantOid: payment.merchantOid,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    refundedAmountMinor: payment.refundedAmountMinor,
  };

  validateRefundPaymentEligibility(snapshot);

  const refundRows = toRefundRowInput(payment.refunds);
  validateRefundRequestAmount({
    payment: snapshot,
    requestedMinor: input.amountMinor,
    refundCurrency: payment.currency,
    refunds: refundRows,
  });

  if (input.idempotencyKey) {
    const existing = payment.refunds.find(
      (r) => r.referenceNo === input.idempotencyKey || r.referenceNo.endsWith(input.idempotencyKey!)
    );
    if (existing) {
      return {
        status: existing.status === "SUCCEEDED" ? "SUCCEEDED" : existing.status === "FAILED" ? "FAILED" : "UNKNOWN",
        refundId: existing.id,
        referenceNo: existing.referenceNo,
      };
    }
  }

  const referenceNo = input.idempotencyKey ?? generateRefundReferenceNo();

  const duplicateRef = await db.paymentRefund.findUnique({ where: { referenceNo } });
  if (duplicateRef) {
    return {
      status:
        duplicateRef.status === "SUCCEEDED"
          ? "SUCCEEDED"
          : duplicateRef.status === "FAILED"
            ? "FAILED"
            : "UNKNOWN",
      refundId: duplicateRef.id,
      referenceNo: duplicateRef.referenceNo,
    };
  }

  const created = await db.$transaction(async (tx) => {
    const fresh = await tx.membershipPayment.findUnique({
      where: { id: payment.id },
      include: {
        refunds: {
          select: {
            status: true,
            amountMinor: true,
            currency: true,
            completedAt: true,
          },
        },
      },
    });

    if (!fresh) {
      throw new PaymentRefundValidationError("Ödeme kaydı bulunamadı.", "NOT_FOUND", 404);
    }

    const freshSnapshot: RefundPaymentSnapshot = {
      id: fresh.id,
      companyId: fresh.companyId,
      subscriptionId: fresh.subscriptionId,
      status: fresh.status,
      providerEnum: fresh.providerEnum,
      merchantOid: fresh.merchantOid,
      amountMinor: fresh.amountMinor,
      currency: fresh.currency,
      refundedAmountMinor: fresh.refundedAmountMinor,
    };

    validateRefundPaymentEligibility(freshSnapshot);
    validateRefundRequestAmount({
      payment: freshSnapshot,
      requestedMinor: input.amountMinor,
      refundCurrency: fresh.currency,
      refunds: toRefundRowInput(fresh.refunds),
    });

    return tx.paymentRefund.create({
      data: {
        companyId: fresh.companyId,
        paymentId: fresh.id,
        provider: "PAYTR",
        referenceNo,
        amountMinor: input.amountMinor,
        currency: fresh.currency,
        reason: input.reason,
        status: "PROCESSING",
        requestedByUserId: input.requestedByUserId,
      },
    });
  });

  await logRefundAudit({
    actorUserId: input.requestedByUserId,
    payment: snapshot,
    action: "PAYMENT_REFUND_REQUESTED",
    refundId: created.id,
    amountMinor: input.amountMinor,
    metadata: { referenceNo },
  });

  let result: Awaited<ReturnType<ReturnType<typeof createPaytrAdapter>["refundPayment"]>>;
  try {
    result = await createPaytrAdapter().refundPayment({
      merchantOid: payment.merchantOid!,
      referenceNo,
      amountMinor: input.amountMinor,
    });
  } catch (err) {
    await db.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureMessage: err instanceof Error ? err.message : "Provider iade hatası",
      },
    });
    await logRefundAudit({
      actorUserId: input.requestedByUserId,
      payment: snapshot,
      action: "PAYMENT_REFUND_FAILED",
      refundId: created.id,
      metadata: { referenceNo },
    });
    invalidateAdminPaymentCaches(
      payment.id,
      payment.companyId,
      payment.subscriptionId ?? undefined
    );
    throw err;
  }

  const redactedResponse = redactProviderRefundResponse(result.raw) as Prisma.InputJsonValue | undefined;

  if (result.status === "unknown") {
    await db.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "UNKNOWN",
        providerStatus: result.providerStatus,
        providerResponse: redactedResponse,
      },
    });
    invalidateAdminPaymentCaches(
      payment.id,
      payment.companyId,
      payment.subscriptionId ?? undefined
    );
    return { status: "UNKNOWN", refundId: created.id, referenceNo };
  }

  if (result.status === "failed") {
    await db.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        providerStatus: result.providerStatus,
        providerResponse: redactedResponse,
        failedAt: new Date(),
        failureMessage: "PayTR iade isteği başarısız.",
      },
    });
    await logRefundAudit({
      actorUserId: input.requestedByUserId,
      payment: snapshot,
      action: "PAYMENT_REFUND_FAILED",
      refundId: created.id,
      metadata: { referenceNo, providerStatus: result.providerStatus },
    });
    invalidateAdminPaymentCaches(
      payment.id,
      payment.companyId,
      payment.subscriptionId ?? undefined
    );
    return { status: "FAILED", refundId: created.id, referenceNo };
  }

  const finalState = await db.$transaction(async (tx) => {
    const fresh = await tx.membershipPayment.findUnique({
      where: { id: payment.id },
      include: {
        refunds: {
          select: { status: true, amountMinor: true, currency: true, completedAt: true },
        },
      },
    });

    if (!fresh?.amountMinor) {
      throw new PaymentRefundValidationError("Ödeme kaydı bulunamadı.", "NOT_FOUND", 404);
    }

    const completedBefore = sumCompletedRefundsMinor(
      toRefundRowInput(fresh.refunds),
      fresh.currency
    );

    validateRefundRequestAmount({
      payment: {
        id: fresh.id,
        companyId: fresh.companyId,
        subscriptionId: fresh.subscriptionId,
        status: fresh.status,
        providerEnum: fresh.providerEnum,
        merchantOid: fresh.merchantOid,
        amountMinor: fresh.amountMinor,
        currency: fresh.currency,
        refundedAmountMinor: fresh.refundedAmountMinor,
      },
      requestedMinor: input.amountMinor,
      refundCurrency: fresh.currency,
      refunds: toRefundRowInput(fresh.refunds),
    });

    const refundedAmountMinor = completedBefore + input.amountMinor;
    const paymentStatus = resolveRefundPaymentStatus(
      fresh.amountMinor,
      completedBefore,
      input.amountMinor
    );

    assertRefundStateTransition(fresh.status, paymentStatus);

    const earning = await (tx.partnerEarning as any).findUnique({
      where: { membershipPaymentId: payment.id },
    });

    if (earning) {
      const ratio = input.amountMinor / fresh.amountMinor;
      await tx.partnerEarning.create({
        data: {
          partnerId: earning.partnerId,
          conversionId: earning.conversionId,
          membershipPaymentId: undefined,
          reversalOfEarningId: earning.id,
          amount: -Number(earning.amount) * ratio,
          currency: earning.currency,
          status: earning.status === "PAID" ? "PAYABLE" : earning.status,
          description: `İade komisyon ters kaydı · ${referenceNo}`,
          availableAt: new Date(),
        } as any,
      });
    }

    await restoreDiscountRedemptionsOnRefund(
      {
        paymentId: payment.id,
        refundedAmountMinor,
        totalPaymentAmountMinor: fresh.amountMinor,
        actorUserId: input.requestedByUserId,
      },
      tx
    );

    await tx.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "SUCCEEDED",
        providerStatus: result.providerStatus,
        providerResponse: redactedResponse,
        completedAt: new Date(),
      },
    });

    await tx.membershipPayment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        refundedAmountMinor,
      },
    });

    await enqueueBillingOutboxEvent(
      {
        companyId: payment.companyId,
        type: "REFUND_SUCCEEDED",
        aggregateType: "PaymentRefund",
        aggregateId: created.id,
        payload: {
          paymentId: payment.id,
          refundId: created.id,
          amountMinor: input.amountMinor,
        },
      },
      tx
    );

    return { paymentStatus, refundedAmountMinor };
  });

  await logRefundAudit({
    actorUserId: input.requestedByUserId,
    payment: snapshot,
    action: "PAYMENT_REFUND_COMPLETED",
    refundId: created.id,
    amountMinor: input.amountMinor,
    metadata: {
      referenceNo,
      paymentStatus: finalState.paymentStatus,
      refundedAmountMinor: finalState.refundedAmountMinor,
    },
  });

  invalidateAdminPaymentCaches(
    payment.id,
    payment.companyId,
    payment.subscriptionId ?? undefined
  );

  return {
    status: "SUCCEEDED",
    refundId: created.id,
    referenceNo,
    paymentStatus: finalState.paymentStatus,
    refundedAmountMinor: finalState.refundedAmountMinor,
  };
}
