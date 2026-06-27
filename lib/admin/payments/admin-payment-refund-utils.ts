export type RefundRowInput = {
  status: string;
  amountMinor: number;
  currency: string;
  completedAt: Date | string | null;
};

export type PaymentRefundSnapshot = {
  amountMinor: number | null;
  currency: string;
  refundedAmountMinor: number | null;
  status: string;
};

export const COMPLETED_REFUND_STATUSES = new Set(["SUCCEEDED"]);

/**
 * Tamamlanmış iade toplamı — yalnız SUCCEEDED + completedAt.
 * payment.refundedAmountMinor ile çift sayım yapmaz; refund satırları source of truth.
 */
export function sumCompletedRefundsMinor(
  refunds: RefundRowInput[],
  expectedCurrency: string
): number {
  return refunds
    .filter(
      (r) =>
        COMPLETED_REFUND_STATUSES.has(r.status) &&
        r.completedAt != null &&
        r.currency === expectedCurrency
    )
    .reduce((sum, r) => sum + r.amountMinor, 0);
}

export function sumPendingRefundsMinor(
  refunds: RefundRowInput[],
  expectedCurrency: string
): number {
  return refunds
    .filter(
      (r) =>
        (r.status === "PROCESSING" || r.status === "REQUESTED" || r.status === "UNKNOWN") &&
        r.currency === expectedCurrency
    )
    .reduce((sum, r) => sum + r.amountMinor, 0);
}

export function getMaxRefundableMinor(input: {
  paymentAmountMinor: number;
  currency: string;
  refunds: RefundRowInput[];
}): number {
  const completed = sumCompletedRefundsMinor(input.refunds, input.currency);
  const pending = sumPendingRefundsMinor(input.refunds, input.currency);
  return Math.max(0, input.paymentAmountMinor - completed - pending);
}

export function validateRefundAmount(input: {
  requestedMinor: number;
  paymentAmountMinor: number;
  currency: string;
  refundCurrency: string;
  refunds: RefundRowInput[];
}): { ok: true } | { ok: false; message: string } {
  if (input.currency !== input.refundCurrency) {
    return { ok: false, message: "İade para birimi ödeme para birimiyle eşleşmiyor." };
  }
  if (!Number.isInteger(input.requestedMinor) || input.requestedMinor <= 0) {
    return { ok: false, message: "İade tutarı pozitif olmalıdır." };
  }
  const max = getMaxRefundableMinor({
    paymentAmountMinor: input.paymentAmountMinor,
    currency: input.currency,
    refunds: input.refunds,
  });
  if (input.requestedMinor > max) {
    return { ok: false, message: "İade toplamı ödeme tutarını aşamaz." };
  }
  return { ok: true };
}

export function reconcileRefundedAmountMinor(input: {
  payment: PaymentRefundSnapshot;
  refunds: RefundRowInput[];
}): {
  fromRefunds: number;
  fromPaymentField: number;
  mismatch: boolean;
} {
  const fromRefunds = sumCompletedRefundsMinor(input.refunds, input.payment.currency);
  const fromPaymentField = input.payment.refundedAmountMinor ?? 0;
  return {
    fromRefunds,
    fromPaymentField,
    mismatch: fromRefunds !== fromPaymentField,
  };
}
