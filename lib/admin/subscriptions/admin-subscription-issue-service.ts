import { db } from "@/lib/prisma";

export type SubscriptionIssue =
  | "DUPLICATE_ACTIVE_SUBSCRIPTION"
  | "ACTIVE_NO_PLAN"
  | "ACTIVE_NO_PRICE"
  | "PERIOD_END_PAST"
  | "TRIAL_END_PAST"
  | "PAST_DUE_HAS_SUCCESS_PAYMENT"
  | "CANCEL_AT_PERIOD_END_NO_END_DATE"
  | "PAID_SUBSCRIPTION_NOT_ACTIVE"
  | "ACTIVE_NO_PAYMENT_HISTORY"
  | "COMPANY_ARCHIVED_SUBSCRIPTION_ACTIVE"
  | "COMPANY_SUSPENDED_SUBSCRIPTION_ACTIVE"
  | "CAMPAIGN_EXPIRED_DISCOUNT_ACTIVE"
  | "PROVIDER_STATUS_MISMATCH";

export const ISSUE_LABELS: Record<SubscriptionIssue, string> = {
  DUPLICATE_ACTIVE_SUBSCRIPTION: "Firmada birden fazla aktif abonelik",
  ACTIVE_NO_PLAN: "Aktif abonelikte plan yok",
  ACTIVE_NO_PRICE: "Aktif abonelikte fiyat yok",
  PERIOD_END_PAST: "Dönem sonu geçti, durum güncellenmemiş",
  TRIAL_END_PAST: "Trial süresi doldu, durum güncellenmemiş",
  PAST_DUE_HAS_SUCCESS_PAYMENT: "PAST_DUE ama başarılı ödeme var",
  CANCEL_AT_PERIOD_END_NO_END_DATE: "İptal planlandı ama dönem sonu tarihi yok",
  PAID_SUBSCRIPTION_NOT_ACTIVE: "Ödeme alındı ama abonelik aktif değil",
  ACTIVE_NO_PAYMENT_HISTORY: "Aktif ücretli abonelikte ödeme kaydı yok",
  COMPANY_ARCHIVED_SUBSCRIPTION_ACTIVE: "Firma arşivlenmiş, abonelik aktif",
  COMPANY_SUSPENDED_SUBSCRIPTION_ACTIVE: "Firma askıda, abonelik aktif",
  CAMPAIGN_EXPIRED_DISCOUNT_ACTIVE: "Kampanya süresi dolmuş, indirim uygulanıyor",
  PROVIDER_STATUS_MISMATCH: "Provider/local durum uyuşmazlığı",
};

export function getIssueLabel(issue: SubscriptionIssue): string {
  return ISSUE_LABELS[issue] ?? issue;
}

export const ISSUE_TAB_LINKS: Partial<
  Record<SubscriptionIssue, "overview" | "payments" | "history" | "entitlements" | "addons" | "activity" | "notes">
> = {
  DUPLICATE_ACTIVE_SUBSCRIPTION: "overview",
  ACTIVE_NO_PLAN: "overview",
  ACTIVE_NO_PRICE: "overview",
  PERIOD_END_PAST: "overview",
  TRIAL_END_PAST: "overview",
  PAST_DUE_HAS_SUCCESS_PAYMENT: "payments",
  CANCEL_AT_PERIOD_END_NO_END_DATE: "overview",
  PAID_SUBSCRIPTION_NOT_ACTIVE: "payments",
  ACTIVE_NO_PAYMENT_HISTORY: "payments",
  COMPANY_ARCHIVED_SUBSCRIPTION_ACTIVE: "overview",
  COMPANY_SUSPENDED_SUBSCRIPTION_ACTIVE: "overview",
  CAMPAIGN_EXPIRED_DISCOUNT_ACTIVE: "overview",
  PROVIDER_STATUS_MISMATCH: "overview",
};

export function detectSubscriptionIssues(input: {
  status: string;
  planId: string | null | undefined;
  lockedPriceMinor: number | null | undefined;
  currentPeriodEnd: Date | null | undefined;
  trialEndsAt: Date | null | undefined;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null | undefined;
  companyStatus: string;
  lastPaymentStatus: string | null | undefined;
  paymentCount: number;
  failedPaymentCount: number;
  isFree?: boolean;
}): SubscriptionIssue[] {
  const now = new Date();
  const issues: SubscriptionIssue[] = [];

  if (input.status === "ACTIVE" && !input.planId) {
    issues.push("ACTIVE_NO_PLAN");
  }

  if (
    (input.status === "ACTIVE" || input.status === "PAST_DUE") &&
    !input.isFree &&
    !input.lockedPriceMinor
  ) {
    issues.push("ACTIVE_NO_PRICE");
  }

  if (
    input.status === "ACTIVE" &&
    input.currentPeriodEnd &&
    input.currentPeriodEnd < now
  ) {
    issues.push("PERIOD_END_PAST");
  }

  if (input.status === "TRIAL" && input.trialEndsAt && input.trialEndsAt < now) {
    issues.push("TRIAL_END_PAST");
  }

  if (
    input.status === "PAST_DUE" &&
    input.lastPaymentStatus === "PAID"
  ) {
    issues.push("PAST_DUE_HAS_SUCCESS_PAYMENT");
  }

  if (input.cancelAtPeriodEnd && !input.currentPeriodEnd) {
    issues.push("CANCEL_AT_PERIOD_END_NO_END_DATE");
  }

  if (
    input.status !== "ACTIVE" &&
    input.status !== "TRIAL" &&
    input.lastPaymentStatus === "PAID" &&
    !input.cancelledAt
  ) {
    issues.push("PAID_SUBSCRIPTION_NOT_ACTIVE");
  }

  if (
    (input.status === "ACTIVE" || input.status === "PAST_DUE") &&
    !input.isFree &&
    input.paymentCount === 0
  ) {
    issues.push("ACTIVE_NO_PAYMENT_HISTORY");
  }

  if (
    (input.status === "ACTIVE" || input.status === "TRIAL") &&
    input.companyStatus === "SUSPENDED"
  ) {
    issues.push("COMPANY_SUSPENDED_SUBSCRIPTION_ACTIVE");
  }

  return issues;
}

export async function detectSubscriptionIssuesForCompany(
  companyId: string
): Promise<SubscriptionIssue[]> {
  const [subs, company] = await Promise.all([
    db.companySubscription.findMany({
      where: {
        companyId,
        status: { in: ["ACTIVE", "TRIAL", "PAST_DUE", "GRACE_PERIOD"] },
      },
      include: {
        plan: { select: { id: true, monthlyPrice: true } },
      },
    }),
    db.company.findUnique({ where: { id: companyId }, select: { status: true } }),
  ]);

  if (!company) return [];

  const issues: SubscriptionIssue[] = [];

  const activeSubs = subs.filter((s) =>
    ["ACTIVE", "TRIAL", "PAST_DUE"].includes(s.status)
  );
  if (activeSubs.length > 1) {
    issues.push("DUPLICATE_ACTIVE_SUBSCRIPTION");
  }

  for (const sub of subs) {
    const isFree = sub.plan ? Number(sub.plan.monthlyPrice) === 0 : false;
    const lastPayment = await db.membershipPayment.findFirst({
      where: { companyId, subscriptionId: sub.id },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    });
    const paymentCount = await db.membershipPayment.count({
      where: { companyId, subscriptionId: sub.id },
    });
    const subIssues = detectSubscriptionIssues({
      status: sub.status,
      planId: sub.planId,
      lockedPriceMinor: sub.lockedPriceMinor,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEndsAt: sub.trialEndsAt,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      cancelledAt: sub.cancelledAt,
      companyStatus: company.status,
      lastPaymentStatus: lastPayment?.status ?? null,
      paymentCount,
      failedPaymentCount: sub.failedPaymentCount,
      isFree,
    });
    issues.push(...subIssues);
  }

  return [...new Set(issues)];
}
