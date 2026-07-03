import type { CheckStatusResult } from "../checkout-provider";
import { SipayError } from "./sipay-errors";

export type PaymentAttemptVerificationTarget = {
  invoiceId: string;
  amountMinor: number;
  currency: string;
  companyId: string;
  planId?: string | null;
  planPriceId?: string | null;
  priceSnapshot?: Record<string, unknown> | null;
  providerPaymentId?: string | null;
};

function normalizeCurrencyCode(currency: string | null | undefined): string {
  const value = (currency ?? "TRY").trim().toUpperCase();
  if (value === "TL") return "TRY";
  return value || "TRY";
}

function verificationError(message: string): SipayError {
  return new SipayError(message, "VERIFICATION_FAILED", 422);
}

export function assertPaymentAttemptSnapshotConsistency(
  attempt: PaymentAttemptVerificationTarget,
): void {
  const snapshot = attempt.priceSnapshot;
  if (!snapshot) {
    throw new SipayError("PaymentAttempt priceSnapshot eksik.", "VERIFICATION_FAILED", 500);
  }

  const snapshotPlanId = snapshot.planId;
  const snapshotPlanPriceId = snapshot.planPriceId;
  const resolvedPlanId =
    typeof snapshotPlanId === "string" && snapshotPlanId.length > 0
      ? snapshotPlanId
      : attempt.planId;

  if (!resolvedPlanId) {
    throw verificationError("PaymentAttempt planId eksik.");
  }

  if (attempt.planId && snapshotPlanId && attempt.planId !== snapshotPlanId) {
    throw verificationError("PaymentAttempt planId snapshot uyuşmazlığı");
  }

  if (
    attempt.planPriceId &&
    typeof snapshotPlanPriceId === "string" &&
    !snapshotPlanPriceId.startsWith("legacy-") &&
    attempt.planPriceId !== snapshotPlanPriceId
  ) {
    throw verificationError("PaymentAttempt planPriceId snapshot uyuşmazlığı");
  }

  if (snapshot.totalMinor != null && snapshot.totalMinor !== attempt.amountMinor) {
    throw verificationError("PaymentAttempt tutar snapshot uyuşmazlığı");
  }

  if (
    snapshot.currency &&
    normalizeCurrencyCode(String(snapshot.currency)) !== normalizeCurrencyCode(attempt.currency)
  ) {
    throw verificationError("PaymentAttempt currency snapshot uyuşmazlığı");
  }
}

export function assertCheckStatusMatchesAttempt(
  attempt: PaymentAttemptVerificationTarget,
  status: CheckStatusResult,
): void {
  assertPaymentAttemptSnapshotConsistency(attempt);

  if (status.invoiceId && status.invoiceId !== attempt.invoiceId) {
    throw verificationError("Sipay invoice uyuşmazlığı");
  }

  if (status.amountMinor != null && status.amountMinor !== attempt.amountMinor) {
    throw verificationError(
      `Sipay tutar uyuşmazlığı: beklenen ${attempt.amountMinor}, alınan ${status.amountMinor}`,
    );
  }

  if (status.currency) {
    const expected = normalizeCurrencyCode(attempt.currency);
    const received = normalizeCurrencyCode(status.currency);
    if (expected !== received) {
      throw verificationError(
        `Sipay para birimi uyuşmazlığı: beklenen ${expected}, alınan ${received}`,
      );
    }
  }

  if (
    attempt.providerPaymentId &&
    status.providerPaymentId &&
    status.providerPaymentId !== attempt.providerPaymentId
  ) {
    throw verificationError("Sipay order/transaction uyuşmazlığı");
  }
}

export function buildPaymentAttemptVerificationTarget(input: {
  invoiceId: string;
  amountMinor: number;
  currency: string;
  companyId: string;
  planId?: string | null;
  planPriceId?: string | null;
  priceSnapshot?: Record<string, unknown> | null;
  providerPaymentId?: string | null;
}): PaymentAttemptVerificationTarget {
  return {
    invoiceId: input.invoiceId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    companyId: input.companyId,
    planId: input.planId,
    planPriceId: input.planPriceId,
    priceSnapshot: input.priceSnapshot,
    providerPaymentId: input.providerPaymentId,
  };
}
