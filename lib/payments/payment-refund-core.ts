import {
  getMaxRefundableMinor,
  sumCompletedRefundsMinor,
  sumPendingRefundsMinor,
  validateRefundAmount,
  type RefundRowInput,
} from "@/lib/admin/payments/admin-payment-refund-utils";
import { assertPaymentTransition } from "@/lib/payments/payment-state-machine";
import type { MembershipPaymentStatus } from "@prisma/client";

export class PaymentRefundValidationError extends Error {
  status: number;
  code: string;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "PaymentRefundValidationError";
    this.code = code;
    this.status = status;
  }
}

export type RefundPaymentSnapshot = {
  id: string;
  companyId: string;
  subscriptionId: string | null;
  status: MembershipPaymentStatus;
  providerEnum: string | null;
  merchantOid: string | null;
  amountMinor: number | null;
  currency: string;
  refundedAmountMinor: number;
};

export function validateRefundReason(reason: string | undefined | null): void {
  if (!reason?.trim() || reason.trim().length < 3) {
    throw new PaymentRefundValidationError("İade nedeni zorunludur (min 3 karakter).", "REASON_REQUIRED");
  }
}

export function validateRefundPaymentEligibility(payment: RefundPaymentSnapshot): void {
  if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.status)) {
    throw new PaymentRefundValidationError(
      "Yalnız başarılı veya kısmi iade edilmiş ödemeler iade edilebilir.",
      "INVALID_PAYMENT_STATUS",
      409
    );
  }

  if (payment.providerEnum !== "PAYTR") {
    throw new PaymentRefundValidationError(
      "Bu provider için iade desteklenmiyor.",
      "PROVIDER_NOT_SUPPORTED",
      422
    );
  }

  if (!payment.merchantOid || !payment.amountMinor || payment.amountMinor <= 0) {
    throw new PaymentRefundValidationError(
      "Bu ödeme PayTR iadesi için uygun değil.",
      "MISSING_PROVIDER_REFERENCE",
      422
    );
  }
}

export function validateRefundRequestAmount(input: {
  payment: RefundPaymentSnapshot;
  requestedMinor: number;
  refundCurrency: string;
  refunds: RefundRowInput[];
}): { maxRefundableMinor: number; completedMinor: number; pendingMinor: number } {
  if (!Number.isInteger(input.requestedMinor) || input.requestedMinor <= 0) {
    throw new PaymentRefundValidationError("İade tutarı pozitif olmalıdır.", "INVALID_AMOUNT");
  }

  const validation = validateRefundAmount({
    requestedMinor: input.requestedMinor,
    paymentAmountMinor: input.payment.amountMinor!,
    currency: input.payment.currency,
    refundCurrency: input.refundCurrency,
    refunds: input.refunds,
  });

  if (!validation.ok) {
    const code = input.refundCurrency !== input.payment.currency ? "CURRENCY_MISMATCH" : "REFUND_OVERFLOW";
    throw new PaymentRefundValidationError(validation.message, code, 409);
  }

  const completedMinor = sumCompletedRefundsMinor(input.refunds, input.payment.currency);
  const pendingMinor = sumPendingRefundsMinor(input.refunds, input.payment.currency);
  const maxRefundableMinor = getMaxRefundableMinor({
    paymentAmountMinor: input.payment.amountMinor!,
    currency: input.payment.currency,
    refunds: input.refunds,
  });

  return { maxRefundableMinor, completedMinor, pendingMinor };
}

export function resolveRefundPaymentStatus(
  paymentAmountMinor: number,
  completedRefundMinor: number,
  requestedMinor: number
): MembershipPaymentStatus {
  const total = completedRefundMinor + requestedMinor;
  return total >= paymentAmountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

export function assertRefundStateTransition(
  from: MembershipPaymentStatus,
  to: MembershipPaymentStatus
): void {
  assertPaymentTransition(from, to);
}

export function toRefundRowInput(
  refunds: Array<{
    status: string;
    amountMinor: number;
    currency: string;
    completedAt: Date | null;
  }>
): RefundRowInput[] {
  return refunds.map((r) => ({
    status: r.status,
    amountMinor: r.amountMinor,
    currency: r.currency,
    completedAt: r.completedAt,
  }));
}
