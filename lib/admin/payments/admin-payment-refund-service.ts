import {
  getMaxRefundableMinor,
  reconcileRefundedAmountMinor,
  sumCompletedRefundsMinor,
  sumPendingRefundsMinor,
  type RefundRowInput,
} from "@/lib/admin/payments/admin-payment-refund-utils";

export type RefundGateCheck = {
  canInitiate: boolean;
  reasons: string[];
  maxRefundableMinor: number;
  completedRefundMinor: number;
  pendingRefundMinor: number;
  currency: string;
  providerSupported: boolean;
  /** Eksik güvenlik kapıları — UI read-only kalır */
  missingGates: string[];
};

const REQUIRED_GATES = [
  "super_admin",
  "max_refundable",
  "completed_deduction",
  "partial_full_support",
  "currency_check",
  "provider_support",
  "reason_required",
  "idempotency_reference",
  "double_submit_guard",
  "audit_logging",
  "cache_invalidation",
  "safe_state_transition",
] as const;

/**
 * Refund modal yalnız tüm kapılar sağlandığında açılır.
 * Mevcut refund servisi audit ve cache invalidation içermiyorsa read-only kalır.
 */
export function evaluateRefundUiGate(input: {
  isSuperAdmin: boolean;
  paymentStatus: string;
  providerEnum: string | null;
  merchantOid: string | null;
  amountMinor: number | null;
  currency: string;
  refunds: RefundRowInput[];
  hasAuditOnRefund: boolean;
  hasCacheInvalidationOnRefund: boolean;
}): RefundGateCheck {
  const missingGates: string[] = [];
  const reasons: string[] = [];

  if (!input.isSuperAdmin) {
    missingGates.push("super_admin");
    reasons.push("Yalnız Super Admin iade başlatabilir.");
  }

  const amountMinor = input.amountMinor ?? 0;
  const completedRefundMinor = sumCompletedRefundsMinor(input.refunds, input.currency);
  const pendingRefundMinor = sumPendingRefundsMinor(input.refunds, input.currency);
  const maxRefundableMinor = getMaxRefundableMinor({
    paymentAmountMinor: amountMinor,
    currency: input.currency,
    refunds: input.refunds,
  });

  const providerSupported =
    input.providerEnum === "PAYTR" && !!input.merchantOid && amountMinor > 0;

  if (!providerSupported) {
    missingGates.push("provider_support");
    reasons.push("Bu ödeme PayTR iadesi için uygun değil.");
  }

  if (!["PAID", "PARTIALLY_REFUNDED"].includes(input.paymentStatus)) {
    missingGates.push("safe_state_transition");
    reasons.push("Yalnız başarılı veya kısmi iade edilmiş ödemeler iade edilebilir.");
  }

  if (maxRefundableMinor <= 0) {
    missingGates.push("max_refundable");
    reasons.push("İade edilebilir tutar kalmadı.");
  }

  if (!input.hasAuditOnRefund) {
    missingGates.push("audit_logging");
    reasons.push("İade audit kaydı henüz bağlanmadı.");
  }

  if (!input.hasCacheInvalidationOnRefund) {
    missingGates.push("cache_invalidation");
    reasons.push("İade sonrası cache invalidation henüz bağlanmadı.");
  }

  // Servis tarafında mevcut olanlar — kapı olarak işaretle
  const presentGates = new Set<string>([
    "max_refundable",
    "completed_deduction",
    "partial_full_support",
    "currency_check",
    "reason_required",
    "idempotency_reference",
    "double_submit_guard",
  ]);

  if (providerSupported) presentGates.add("provider_support");
  if (input.isSuperAdmin) presentGates.add("super_admin");
  if (["PAID", "PARTIALLY_REFUNDED"].includes(input.paymentStatus)) {
    presentGates.add("safe_state_transition");
  }
  if (input.hasAuditOnRefund) presentGates.add("audit_logging");
  if (input.hasCacheInvalidationOnRefund) presentGates.add("cache_invalidation");

  for (const gate of REQUIRED_GATES) {
    if (!presentGates.has(gate) && !missingGates.includes(gate)) {
      missingGates.push(gate);
    }
  }

  const canInitiate = missingGates.length === 0;

  return {
    canInitiate,
    reasons,
    maxRefundableMinor,
    completedRefundMinor,
    pendingRefundMinor,
    currency: input.currency,
    providerSupported,
    missingGates,
  };
}

export function serializeRefundRows(
  refunds: Array<{
    id: string;
    referenceNo: string;
    amountMinor: number;
    currency: string;
    status: string;
    reason: string;
    completedAt: Date | null;
    failedAt: Date | null;
    failureMessage: string | null;
    requestedAt: Date;
    createdAt: Date;
  }>
) {
  return refunds.map((r) => ({
    id: r.id,
    referenceNo: r.referenceNo,
    amountMinor: r.amountMinor,
    currency: r.currency,
    status: r.status,
    reason: r.reason,
    completedAt: r.completedAt?.toISOString() ?? null,
    failedAt: r.failedAt?.toISOString() ?? null,
    failureMessage: r.failureMessage,
    requestedAt: r.requestedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export { reconcileRefundedAmountMinor, sumCompletedRefundsMinor };
