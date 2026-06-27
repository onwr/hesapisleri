export type PaymentIssue =
  | "PENDING_TIMEOUT"
  | "CALLBACK_MISSING"
  | "CALLBACK_INVALID"
  | "PROVIDER_STATUS_MISMATCH"
  | "PAID_SUBSCRIPTION_INACTIVE"
  | "FAILED_SUBSCRIPTION_ACTIVE"
  | "SUBSCRIPTION_NOT_LINKED_EXPECTED"
  | "SUBSCRIPTION_MISSING_UNEXPECTED"
  | "SUBSCRIPTION_NOT_FOUND"
  | "COMPANY_SUBSCRIPTION_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "PRICE_COMPARISON_UNAVAILABLE"
  | "CURRENCY_MISMATCH"
  | "REFUND_OVERFLOW"
  | "OUTBOX_FAILED"
  | "PROVIDER_REF_MISSING"
  | "PAID_WITHOUT_PAID_AT"
  | "FAILED_WITHOUT_ERROR_SUMMARY"
  | "DUPLICATE_MERCHANT_OID_ATTEMPT";

export const ISSUE_LABELS: Record<PaymentIssue, string> = {
  PENDING_TIMEOUT: "Uzun süredir bekleyen ödeme",
  CALLBACK_MISSING: "Callback alınmamış",
  CALLBACK_INVALID: "Callback doğrulaması başarısız",
  PROVIDER_STATUS_MISMATCH: "Provider/local durum uyuşmazlığı",
  PAID_SUBSCRIPTION_INACTIVE: "Ödeme başarılı ancak abonelik aktif değil",
  FAILED_SUBSCRIPTION_ACTIVE: "Ödeme başarısız ancak abonelik aktif",
  SUBSCRIPTION_NOT_LINKED_EXPECTED: "Aboneliğe bağlanması beklenen ödeme bağlı değil",
  SUBSCRIPTION_MISSING_UNEXPECTED: "Beklenmeyen şekilde aboneliğe bağlı değil",
  SUBSCRIPTION_NOT_FOUND: "Bağlı abonelik bulunamadı",
  COMPANY_SUBSCRIPTION_MISMATCH: "Ödeme ve abonelik farklı firmalara ait",
  AMOUNT_MISMATCH: "Ödeme tutarı snapshot ile uyuşmuyor",
  PRICE_COMPARISON_UNAVAILABLE: "Fiyat karşılaştırması yapılamıyor",
  CURRENCY_MISMATCH: "Para birimi uyuşmazlığı",
  REFUND_OVERFLOW: "İade toplamı ödeme tutarını aşıyor",
  OUTBOX_FAILED: "Billing outbox başarısız",
  PROVIDER_REF_MISSING: "Provider referansı eksik",
  PAID_WITHOUT_PAID_AT: "PAID ancak paidAt yok",
  FAILED_WITHOUT_ERROR_SUMMARY: "Başarısız ödeme ancak hata özeti yok",
  DUPLICATE_MERCHANT_OID_ATTEMPT: "Yinelenen callback denemesi (idempotent)",
};

export const ISSUE_TAB_LINKS: Partial<
  Record<PaymentIssue, "overview" | "provider" | "subscription" | "refunds" | "events">
> = {
  CALLBACK_MISSING: "provider",
  CALLBACK_INVALID: "provider",
  PROVIDER_STATUS_MISMATCH: "provider",
  PAID_SUBSCRIPTION_INACTIVE: "subscription",
  FAILED_SUBSCRIPTION_ACTIVE: "subscription",
  SUBSCRIPTION_NOT_LINKED_EXPECTED: "subscription",
  SUBSCRIPTION_MISSING_UNEXPECTED: "subscription",
  SUBSCRIPTION_NOT_FOUND: "subscription",
  COMPANY_SUBSCRIPTION_MISMATCH: "subscription",
  AMOUNT_MISMATCH: "overview",
  CURRENCY_MISMATCH: "overview",
  REFUND_OVERFLOW: "refunds",
  OUTBOX_FAILED: "events",
  PROVIDER_REF_MISSING: "provider",
};

export function getPaymentIssueLabel(issue: PaymentIssue): string {
  return ISSUE_LABELS[issue] ?? issue;
}

type SnapshotPrice = {
  totalMinor?: number;
  currency?: string;
};

export function readSnapshotTotalMinor(priceSnapshot: unknown): number | null {
  if (!priceSnapshot || typeof priceSnapshot !== "object") return null;
  const snap = priceSnapshot as SnapshotPrice & { totalMinor?: number; salePriceMinor?: number };
  if (typeof snap.totalMinor === "number") return snap.totalMinor;
  return null;
}

export function detectPaymentIssues(input: {
  payment: {
    id: string;
    status: string;
    provider?: string | null;
    providerEnum?: string | null;
    providerStatus?: string | null;
    merchantOid?: string | null;
    amountMinor?: number | null;
    currency: string;
    subscriptionId?: string | null;
    companyId: string;
    paidAt?: Date | string | null;
    callbackReceivedAt?: Date | string | null;
    failedReasonCode?: string | null;
    failedReasonMessage?: string | null;
    priceSnapshot?: unknown;
    type?: string | null;
    createdAt: Date | string;
  };
  subscription?: {
    id: string;
    companyId: string;
    status: string;
  } | null;
  completedRefundMinor: number;
  hasFailedOutbox: boolean;
  webhookInvalidSignature?: boolean;
  webhookDuplicateAttempt?: boolean;
  now?: Date;
}): PaymentIssue[] {
  const issues: PaymentIssue[] = [];
  const now = input.now ?? new Date();
  const p = input.payment;
  const created = new Date(p.createdAt);
  const isTrialPlaceholder = p.provider === "TRIAL";
  const isPaid = p.status === "PAID";
  const isFailed = p.status === "FAILED";
  const isPending = ["PENDING", "WAIT_CALLBACK", "UNKNOWN", "FORM_READY", "CREATED"].includes(
    p.status
  );

  if (isPending && now.getTime() - created.getTime() > 24 * 60 * 60 * 1000) {
    issues.push("PENDING_TIMEOUT");
  }

  if (
    p.providerEnum === "PAYTR" &&
    !p.callbackReceivedAt &&
    !isTrialPlaceholder &&
    now.getTime() - created.getTime() > 2 * 60 * 60 * 1000
  ) {
    issues.push("CALLBACK_MISSING");
  }

  if (input.webhookInvalidSignature) issues.push("CALLBACK_INVALID");
  if (input.webhookDuplicateAttempt) issues.push("DUPLICATE_MERCHANT_OID_ATTEMPT");

  if (
    p.providerStatus &&
    isPaid &&
    p.providerStatus.toLowerCase().includes("fail")
  ) {
    issues.push("PROVIDER_STATUS_MISMATCH");
  }

  if (isPaid && !p.paidAt) issues.push("PAID_WITHOUT_PAID_AT");
  if (isFailed && !p.failedReasonCode && !p.failedReasonMessage) {
    issues.push("FAILED_WITHOUT_ERROR_SUMMARY");
  }

  if (p.providerEnum === "PAYTR" && !p.merchantOid && !isTrialPlaceholder) {
    issues.push("PROVIDER_REF_MISSING");
  }

  const amountMinor = p.amountMinor ?? 0;
  if (input.completedRefundMinor > amountMinor && amountMinor > 0) {
    issues.push("REFUND_OVERFLOW");
  }

  const snapTotal = readSnapshotTotalMinor(p.priceSnapshot);
  if (snapTotal != null && p.amountMinor != null && p.amountMinor !== snapTotal) {
    issues.push("AMOUNT_MISMATCH");
  } else if (
    isPaid &&
    !isTrialPlaceholder &&
    p.amountMinor != null &&
    p.amountMinor > 0 &&
    snapTotal == null
  ) {
    // snapshot yok — yanlış uyarı üretme
  }

  if (input.hasFailedOutbox) issues.push("OUTBOX_FAILED");

  const sub = input.subscription;
  const expectsSubscription =
    !isTrialPlaceholder &&
    p.type !== "LEGACY" &&
    (p.providerEnum === "PAYTR" || p.providerEnum === "MANUAL");

  if (!p.subscriptionId) {
    if (!isTrialPlaceholder && p.providerEnum === "PAYTR" && isPaid) {
      issues.push("SUBSCRIPTION_NOT_LINKED_EXPECTED");
    } else if (expectsSubscription && isPaid) {
      issues.push("SUBSCRIPTION_MISSING_UNEXPECTED");
    }
  } else if (!sub) {
    issues.push("SUBSCRIPTION_NOT_FOUND");
  } else {
    if (sub.companyId !== p.companyId) issues.push("COMPANY_SUBSCRIPTION_MISMATCH");
    if (isPaid && !["ACTIVE", "TRIAL", "GRACE_PERIOD", "CANCEL_AT_PERIOD_END"].includes(sub.status)) {
      issues.push("PAID_SUBSCRIPTION_INACTIVE");
    }
    if (isFailed && ["ACTIVE", "TRIAL"].includes(sub.status)) {
      issues.push("FAILED_SUBSCRIPTION_ACTIVE");
    }
  }

  return [...new Set(issues)];
}
