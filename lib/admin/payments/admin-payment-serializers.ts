import type { MembershipPaymentStatus, PaymentProvider } from "@prisma/client";
import {
  getPaymentStatusClass,
  getPaymentStatusLabel,
  maskProviderRef,
} from "@/lib/admin/subscriptions/admin-subscription-serializers";
import { getSafePaymentErrorSummary } from "@/lib/admin/payments/admin-payment-error-labels";
import { TRIAL_PLACEHOLDER_PROVIDER } from "@/lib/admin/payments/admin-payment-metric-definitions";

export { maskProviderRef, getPaymentStatusLabel, getPaymentStatusClass };

export function isTrialPlaceholderPayment(input: {
  provider?: string | null;
  status?: string;
}): boolean {
  return input.provider === TRIAL_PLACEHOLDER_PROVIDER;
}

export function maskEventKey(eventKey: string | null | undefined): string {
  if (!eventKey) return "—";
  if (eventKey.length <= 12) return "****";
  return eventKey.slice(0, 6) + "…" + eventKey.slice(-4);
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return "—";
}

export function formatPaymentProviderLabel(
  providerEnum: PaymentProvider | null | undefined,
  provider: string | null | undefined
): string {
  if (provider === TRIAL_PLACEHOLDER_PROVIDER) return "Trial (placeholder)";
  return providerEnum ?? provider ?? "—";
}

export function getCallbackStatusLabel(input: {
  callbackReceivedAt: Date | string | null;
  status: MembershipPaymentStatus | string;
  signatureValid?: boolean | null;
}): string {
  if (input.callbackReceivedAt) {
    if (input.signatureValid === false) return "Doğrulama başarısız";
    return "Alındı ve doğrulandı";
  }
  if (input.status === "WAIT_CALLBACK" || input.status === "UNKNOWN") return "Bekleniyor";
  if (input.status === "PAID" || input.status === "FAILED") return "Kayıt yok";
  return "—";
}

export function serializePaymentErrorSummary(payment: {
  status: MembershipPaymentStatus | string;
  failedReasonCode?: string | null;
  failedReasonMessage?: string | null;
  providerStatus?: string | null;
}): string {
  return getSafePaymentErrorSummary(payment);
}
