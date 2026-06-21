import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/lib/prisma";
import { createPaytrAdapter } from "@/lib/payments/providers/paytr/paytr-adapter";
import { enqueueBillingOutboxEvent } from "@/lib/billing/billing-outbox-service";
import { restoreDiscountRedemptionsOnRefund } from "@/lib/billing/discount-refund-service";

function generateRefundReferenceNo() {
  return `RF${new Date().toISOString().slice(0, 10).replaceAll("-", "")}${randomBytes(5).toString("hex").toUpperCase()}`;
}

export async function refundMembershipPayment(input: {
  paymentId: string;
  amountMinor: number;
  reason: string;
  requestedByUserId: string;
}) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("İade tutarı pozitif olmalıdır.");
  }

  const payment = await db.membershipPayment.findUnique({
    where: { id: input.paymentId },
    include: { refunds: true },
  });

  if (!payment || payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new Error("Yalnız başarılı üyelik ödemeleri iade edilebilir.");
  }

  if (!payment.merchantOid || !payment.amountMinor) {
    throw new Error("Bu ödeme PayTR iadesi için uygun değil.");
  }

  const alreadyRefunded = payment.refunds
    .filter((refund) => refund.status === "SUCCEEDED" || refund.status === "PROCESSING")
    .reduce((sum, refund) => sum + refund.amountMinor, 0);

  if (alreadyRefunded + input.amountMinor > payment.amountMinor) {
    throw new Error("İade toplamı ödeme tutarını aşamaz.");
  }

  const referenceNo = generateRefundReferenceNo();
  const created = await db.paymentRefund.create({
    data: {
      companyId: payment.companyId,
      paymentId: payment.id,
      provider: "PAYTR",
      referenceNo,
      amountMinor: input.amountMinor,
      currency: payment.currency,
      reason: input.reason,
      status: "PROCESSING",
      requestedByUserId: input.requestedByUserId,
    },
  });

  const result = await createPaytrAdapter().refundPayment({
    merchantOid: payment.merchantOid,
    referenceNo,
    amountMinor: input.amountMinor,
  });

  if (result.status === "unknown") {
    await db.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "UNKNOWN",
        providerStatus: result.providerStatus,
        providerResponse: result.raw ? result.raw : undefined,
      },
    });
    return { status: "UNKNOWN" as const, refundId: created.id };
  }

  if (result.status === "failed") {
    await db.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "FAILED",
        providerStatus: result.providerStatus,
        providerResponse: result.raw ? result.raw : undefined,
        failedAt: new Date(),
        failureMessage: "PayTR iade isteği başarısız.",
      },
    });
    return { status: "FAILED" as const, refundId: created.id };
  }

  const refundedAmountMinor = alreadyRefunded + input.amountMinor;
  const paymentStatus =
    refundedAmountMinor >= payment.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await db.$transaction(async (tx) => {
    const earning = await (tx.partnerEarning as any).findUnique({
      where: { membershipPaymentId: payment.id },
    });

    if (earning) {
      const ratio = input.amountMinor / payment.amountMinor!;
      await tx.partnerEarning.create({
        data: {
          partnerId: earning.partnerId,
          conversionId: earning.conversionId,
          membershipPaymentId: undefined,
          reversalOfEarningId: earning.id,
          amount: -Number(earning.amount) * ratio,
          currency: earning.currency,
          status: earning.status === "PAID" ? "PAYABLE" : earning.status,
          description: `İade komisyon ters kaydı · ${created.referenceNo}`,
          availableAt: new Date(),
        } as any,
      });
    }

    await restoreDiscountRedemptionsOnRefund(
      {
        paymentId: payment.id,
        refundedAmountMinor,
        totalPaymentAmountMinor: payment.amountMinor!,
        actorUserId: input.requestedByUserId,
      },
      tx
    );

    await tx.paymentRefund.update({
      where: { id: created.id },
      data: {
        status: "SUCCEEDED",
        providerStatus: result.providerStatus,
        providerResponse: result.raw ? result.raw : undefined,
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
    await enqueueBillingOutboxEvent({
      companyId: payment.companyId,
      type: "REFUND_SUCCEEDED",
      aggregateType: "PaymentRefund",
      aggregateId: created.id,
      payload: {
        paymentId: payment.id,
        refundId: created.id,
        amountMinor: input.amountMinor,
      },
    }, tx);
  });

  return { status: "SUCCEEDED" as const, refundId: created.id };
}
