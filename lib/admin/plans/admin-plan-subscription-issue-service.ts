import type { MembershipPlanPrice, MembershipPlan, CompanySubscription } from "@prisma/client";

export type PlanSubscriptionIssueCode =
  | "SUBSCRIPTION_PRICE_UNLOCKED"
  | "LOCKED_PRICE_NOT_FOUND"
  | "NEXT_PRICE_NOT_FOUND"
  | "NEXT_PRICE_ARCHIVED"
  | "SUBSCRIPTION_CURRENCY_MISMATCH"
  | "SNAPSHOT_MISSING"
  | "SUBSCRIPTION_PRICE_UNRESOLVED"
  | "ACTIVE_PERIOD_EXPIRED"
  | "ARCHIVED_PLAN_ACTIVE_SUBSCRIPTION"
  | "DUPLICATE_ACTIVE_SUBSCRIPTION"
  | "GRANDFATHERED_WITHOUT_LOCK"
  | "NEXT_RENEWAL_DATE_MISSING"
  | "PENDING_CHANGE_TARGET_MISMATCH";

export type PlanSubscriptionIssue = {
  code: PlanSubscriptionIssueCode;
  severity: "info" | "warning" | "error";
  message: string;
  subscriptionId: string;
  companyId: string;
};

const LABELS: Record<PlanSubscriptionIssueCode, string> = {
  SUBSCRIPTION_PRICE_UNLOCKED: "Aktif abonelikte fiyat kilidi yok",
  LOCKED_PRICE_NOT_FOUND: "Kilitli fiyat kaydı bulunamıyor",
  NEXT_PRICE_NOT_FOUND: "Planlanan sonraki fiyat kaydı bulunamıyor",
  NEXT_PRICE_ARCHIVED: "Planlanan sonraki fiyat arşivlenmiş",
  SUBSCRIPTION_CURRENCY_MISMATCH: "Abonelik para birimi uyuşmazlığı",
  SNAPSHOT_MISSING: "Fiyat snapshot bulunamıyor",
  SUBSCRIPTION_PRICE_UNRESOLVED: "Fiyat çözümlenemedi",
  ACTIVE_PERIOD_EXPIRED: "Dönem sonu geçmiş fakat abonelik aktif",
  ARCHIVED_PLAN_ACTIVE_SUBSCRIPTION: "Arşivli plana bağlı aktif abonelik",
  DUPLICATE_ACTIVE_SUBSCRIPTION: "Firmada çift sayım riski (duplicate aktif)",
  GRANDFATHERED_WITHOUT_LOCK: "Grandfathered işaretli fakat kilit yok",
  NEXT_RENEWAL_DATE_MISSING: "Sonraki fiyat var fakat geçerlilik tarihi yok",
  PENDING_CHANGE_TARGET_MISMATCH: "Bekleyen plan değişikliği hedefi uyuşmuyor",
};

export function getPlanSubscriptionIssueLabel(code: PlanSubscriptionIssueCode): string {
  return LABELS[code] ?? code;
}

type SubInput = Pick<
  CompanySubscription,
  | "id"
  | "companyId"
  | "status"
  | "lockedPlanPriceId"
  | "lockedPriceMinor"
  | "priceLockType"
  | "nextPlanPriceId"
  | "nextPriceEffectiveAt"
  | "currentPeriodEnd"
  | "billingInterval"
> & {
  lockedPlanPrice: Pick<MembershipPlanPrice, "id" | "currency" | "status" | "monthlyEquivalentMinor"> | null;
  nextPlanPrice: Pick<MembershipPlanPrice, "id" | "currency" | "status"> | null;
  plan: Pick<MembershipPlan, "planStatus" | "defaultCurrency"> | null;
  pendingTargetPlanId?: string | null;
};

export function detectPlanSubscriptionIssues(
  sub: SubInput,
  opts?: { duplicateCompanyIds?: Set<string>; mrrUnresolved?: boolean; now?: Date }
): PlanSubscriptionIssue[] {
  const issues: PlanSubscriptionIssue[] = [];
  const now = opts?.now ?? new Date();

  const push = (code: PlanSubscriptionIssueCode, severity: PlanSubscriptionIssue["severity"], message?: string) => {
    issues.push({
      code,
      severity,
      message: message ?? LABELS[code],
      subscriptionId: sub.id,
      companyId: sub.companyId,
    });
  };

  const isActiveLike = ["ACTIVE", "PAST_DUE", "GRACE_PERIOD"].includes(sub.status);
  const hasLock = Boolean(sub.lockedPlanPriceId || sub.lockedPriceMinor != null);

  if (isActiveLike && !sub.lockedPlanPriceId && sub.lockedPriceMinor == null) {
    push("SUBSCRIPTION_PRICE_UNLOCKED", "warning");
  }

  if (sub.lockedPlanPriceId && !sub.lockedPlanPrice) {
    push("LOCKED_PRICE_NOT_FOUND", "error");
  }

  if (sub.nextPlanPriceId && !sub.nextPlanPrice) {
    push("NEXT_PRICE_NOT_FOUND", "warning");
  }

  if (sub.nextPlanPrice?.status === "ARCHIVED") {
    push("NEXT_PRICE_ARCHIVED", "warning");
  }

  if (sub.nextPlanPriceId && !sub.nextPriceEffectiveAt) {
    push("NEXT_RENEWAL_DATE_MISSING", "info");
  }

  if (
    sub.lockedPlanPrice &&
    sub.plan?.defaultCurrency &&
    sub.lockedPlanPrice.currency !== sub.plan.defaultCurrency
  ) {
    push("SUBSCRIPTION_CURRENCY_MISMATCH", "warning");
  }

  if (isActiveLike && !hasLock && !sub.lockedPlanPrice) {
    push("SNAPSHOT_MISSING", "warning");
  }

  if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
    push("ACTIVE_PERIOD_EXPIRED", "error");
  }

  if (
    sub.plan?.planStatus === "ARCHIVED" &&
    ["ACTIVE", "TRIAL", "PAST_DUE", "CANCEL_AT_PERIOD_END"].includes(sub.status)
  ) {
    push("ARCHIVED_PLAN_ACTIVE_SUBSCRIPTION", "warning");
  }

  if (sub.priceLockType === "GRANDFATHERED" && !hasLock) {
    push("GRANDFATHERED_WITHOUT_LOCK", "warning");
  }

  if (opts?.duplicateCompanyIds?.has(sub.companyId)) {
    push("DUPLICATE_ACTIVE_SUBSCRIPTION", "warning");
  }

  if (opts?.mrrUnresolved && isActiveLike) {
    push("SUBSCRIPTION_PRICE_UNRESOLVED", "error");
  }

  return issues;
}

export function detectPlanSubscriptionIssuesWithPlan(
  sub: SubInput & { planId: string | null },
  pendingTargetPlanId: string | null,
  opts?: { duplicateCompanyIds?: Set<string>; mrrUnresolved?: boolean; now?: Date }
): PlanSubscriptionIssue[] {
  const issues = detectPlanSubscriptionIssues(sub, opts);
  if (pendingTargetPlanId && sub.planId && pendingTargetPlanId !== sub.planId) {
    issues.push({
      code: "PENDING_CHANGE_TARGET_MISMATCH",
      severity: "info",
      message: LABELS.PENDING_CHANGE_TARGET_MISMATCH,
      subscriptionId: sub.id,
      companyId: sub.companyId,
    });
  }
  return issues;
}
