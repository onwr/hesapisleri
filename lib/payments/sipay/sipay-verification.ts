import type { CheckStatusResult } from "../checkout-provider";
import { MembershipServiceError } from "@/lib/membership-service";
import { normalizeCurrency } from "@/lib/payments/money";

export type PaymentAttemptVerificationTarget = {
  invoiceId: string;
  amountMinor: number;
  currency: string;
  providerPaymentId?: string | null;
};

export function assertCheckStatusMatchesAttempt(
  attempt: PaymentAttemptVerificationTarget,
  status: CheckStatusResult,
): void {
  if (status.invoiceId && status.invoiceId !== attempt.invoiceId) {
    throw new MembershipServiceError("Sipay invoice uyuşmazlığı", 422);
  }

  if (status.amountMinor != null && status.amountMinor !== attempt.amountMinor) {
    throw new MembershipServiceError(
      `Sipay tutar uyuşmazlığı: beklenen ${attempt.amountMinor}, alınan ${status.amountMinor}`,
      422,
    );
  }

  if (status.currency) {
    const expected = normalizeCurrency(attempt.currency);
    const received = normalizeCurrency(status.currency);
    if (expected !== received) {
      throw new MembershipServiceError(
        `Sipay para birimi uyuşmazlığı: beklenen ${expected}, alınan ${received}`,
        422,
      );
    }
  }

  if (
    attempt.providerPaymentId &&
    status.providerPaymentId &&
    status.providerPaymentId !== attempt.providerPaymentId
  ) {
    throw new MembershipServiceError("Sipay order/transaction uyuşmazlığı", 422);
  }
}
