import "server-only";

import { db } from "@/lib/prisma";
import { MembershipServiceError } from "@/lib/membership-service";
import { createSipayProvider } from "./sipay-provider";
import { getSipayProvider } from "./sipay-checkout-service";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-transaction-utils";
import { SipayNetworkError } from "./sipay-errors";

export type SipayRefundInput = {
  invoiceId: string;
  referenceNo: string;
  amountMinor: number;
  initiatedByUserId?: string;
};

export type SipayRefundResult = {
  referenceNo: string;
  status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  providerStatus?: string;
};

export async function refundSipayPayment(input: SipayRefundInput): Promise<SipayRefundResult> {
  if (input.amountMinor <= 0) {
    throw new MembershipServiceError("İade tutarı sıfırdan büyük olmalıdır.", 422);
  }

  const existingRefund = await db.paymentRefund.findUnique({
    where: { referenceNo: input.referenceNo },
  });
  if (existingRefund) {
    return {
      referenceNo: input.referenceNo,
      status: existingRefund.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED",
      providerStatus: "idempotent_replay",
    };
  }

  const payment = await db.membershipPayment.findUnique({
    where: { merchantOid: input.invoiceId },
  });

  if (!payment) {
    throw new MembershipServiceError(`Sipay ödeme kaydı bulunamadı: ${input.invoiceId}`, 404);
  }

  if (payment.status === "REFUNDED") {
    return { referenceNo: input.referenceNo, status: "SUCCEEDED", providerStatus: "already_refunded" };
  }

  if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new MembershipServiceError(
      `İade yalnızca PAID veya PARTIALLY_REFUNDED ödemeler için geçerli. Mevcut durum: ${payment.status}`,
      422,
    );
  }

  const originalAmount = payment.amountMinor ?? 0;
  const alreadyRefunded = payment.refundedAmountMinor ?? 0;
  if (alreadyRefunded + input.amountMinor > originalAmount) {
    throw new MembershipServiceError("Toplam iade tutarı orijinal ödemeyi aşamaz.", 422);
  }

  const provider = getSipayProvider();
  let result;
  try {
    result = await provider.refund({
      invoiceId: input.invoiceId,
      referenceNo: input.referenceNo,
      amountMinor: input.amountMinor,
    });
  } catch (error) {
    if (error instanceof SipayNetworkError) {
      return { referenceNo: input.referenceNo, status: "UNKNOWN", providerStatus: "timeout_or_network" };
    }
    throw error;
  }

  if (result.status !== "SUCCEEDED") {
    return result;
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "MembershipPayment" WHERE id = ${payment.id} FOR UPDATE`;

      const freshPayment = await tx.membershipPayment.findUnique({ where: { id: payment.id } });
      if (!freshPayment) {
        throw new MembershipServiceError("Ödeme kaydı bulunamadı.", 404);
      }

      const replayRefund = await tx.paymentRefund.findUnique({
        where: { referenceNo: input.referenceNo },
      });
      if (replayRefund) return;

      const currentRefunded = freshPayment.refundedAmountMinor ?? 0;
      const nextRefunded = currentRefunded + input.amountMinor;
      if (nextRefunded > (freshPayment.amountMinor ?? 0)) {
        throw new MembershipServiceError("Toplam iade tutarı orijinal ödemeyi aşamaz.", 422);
      }

      const newStatus =
        nextRefunded >= (freshPayment.amountMinor ?? 0) ? "REFUNDED" : "PARTIALLY_REFUNDED";

      await tx.membershipPayment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          refundedAmountMinor: nextRefunded,
        },
      });

      await tx.paymentRefund.create({
        data: {
          companyId: payment.companyId,
          paymentId: payment.id,
          provider: "SIPAY",
          referenceNo: input.referenceNo,
          amountMinor: input.amountMinor,
          currency: payment.currency,
          reason: "customer_request",
          status: "SUCCEEDED",
          completedAt: new Date(),
          requestedByUserId: input.initiatedByUserId ?? "system",
        },
      });

      await tx.activityLog.create({
        data: {
          companyId: payment.companyId,
          userId: input.initiatedByUserId ?? undefined,
          action: "UPDATE",
          module: "settings",
          message: `Sipay iadesi tamamlandı: ${input.invoiceId}, tutar: ${input.amountMinor}`,
        },
      });
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error, "referenceNo")) {
      return { referenceNo: input.referenceNo, status: "SUCCEEDED", providerStatus: "idempotent_replay" };
    }
    throw error;
  }

  return result;
}
