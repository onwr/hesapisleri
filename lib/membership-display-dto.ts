import { COMPANY_FINANCE_TIMEZONE } from "@/lib/finance/financial-period";
import {
  getMembershipStatus,
  getRemainingMembershipDays,
  type MembershipSubscriptionLike,
} from "@/lib/membership-utils";

export type CanonicalMembershipDisplay = {
  subscriptionStatus: ReturnType<typeof getMembershipStatus>;
  statusLabel: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
  sourceCompanyId: string;
  isSharedEntitlement: boolean;
  remainingDays: number;
  isExpired: boolean;
  primaryDateLabel: string;
  primaryDateIso: string | null;
  primaryDateDisplay: string | null;
  periodEndDisplay: string | null;
};

const STATUS_LABELS: Record<CanonicalMembershipDisplay["subscriptionStatus"], string> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  EXPIRED: "Süresi doldu",
  PAST_DUE: "Gecikmiş",
  GRACE_PERIOD: "Ek süre",
  CANCEL_AT_PERIOD_END: "İptal bekliyor",
  CANCELLED: "İptal",
  SUSPENDED: "Askıda",
};

export type MembershipDisplaySource = MembershipSubscriptionLike & {
  autoRenew?: boolean;
  cancelAtPeriodEnd?: boolean;
  nextBillingAt?: Date | string | null;
};

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatMembershipDisplayDate(
  value: Date | string | null | undefined
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: COMPANY_FINANCE_TIMEZONE,
  }).format(date);
}

function resolvePrimaryDate(input: {
  status: ReturnType<typeof getMembershipStatus>;
  subscription: MembershipDisplaySource;
}): { label: string; iso: string | null } {
  const { status, subscription } = input;

  if (status === "TRIAL") {
    return {
      label: "Deneme bitişi",
      iso: toIso(subscription.trialEndsAt ?? subscription.currentPeriodEnd),
    };
  }

  if (status === "CANCEL_AT_PERIOD_END" || subscription.cancelAtPeriodEnd) {
    return {
      label: "Şu tarihte sona erecek",
      iso: toIso(subscription.currentPeriodEnd),
    };
  }

  if (
    (status === "ACTIVE" || status === "GRACE_PERIOD") &&
    subscription.autoRenew &&
    subscription.nextBillingAt
  ) {
    return {
      label: "Sonraki yenileme",
      iso: toIso(subscription.nextBillingAt),
    };
  }

  if (status === "EXPIRED") {
    return {
      label: "Bitiş tarihi",
      iso: toIso(subscription.currentPeriodEnd),
    };
  }

  return {
    label: "Paket bitiş tarihi",
    iso: toIso(subscription.currentPeriodEnd),
  };
}

export function resolveMembershipRemainingDays(
  subscription: MembershipDisplaySource,
  referenceDate = new Date()
) {
  const status = getMembershipStatus(subscription, referenceDate);

  if (status === "TRIAL") {
    const trialReference =
      subscription.trialEndsAt ?? subscription.currentPeriodEnd;
    const trialDate =
      trialReference instanceof Date
        ? trialReference
        : trialReference
          ? new Date(trialReference)
          : null;
    return getRemainingMembershipDays(trialDate, referenceDate);
  }

  const periodEnd =
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd
      : subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;

  return getRemainingMembershipDays(periodEnd, referenceDate);
}

export function buildCanonicalMembershipDisplay(input: {
  subscription: MembershipDisplaySource;
  sourceCompanyId: string;
  isSharedEntitlement: boolean;
  referenceDate?: Date;
}): CanonicalMembershipDisplay {
  const { subscription, sourceCompanyId, isSharedEntitlement } = input;
  const referenceDate = input.referenceDate ?? new Date();
  const subscriptionStatus = getMembershipStatus(subscription, referenceDate);
  const remainingDays = resolveMembershipRemainingDays(subscription, referenceDate);
  const primaryDate = resolvePrimaryDate({ status: subscriptionStatus, subscription });

  return {
    subscriptionStatus,
    statusLabel: STATUS_LABELS[subscriptionStatus],
    currentPeriodStart: toIso(subscription.currentPeriodStart),
    currentPeriodEnd: toIso(subscription.currentPeriodEnd),
    nextBillingDate: toIso(subscription.nextBillingAt),
    trialEndsAt: toIso(subscription.trialEndsAt),
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    autoRenew: Boolean(subscription.autoRenew),
    sourceCompanyId,
    isSharedEntitlement,
    remainingDays,
    isExpired: subscriptionStatus === "EXPIRED",
    primaryDateLabel: primaryDate.label,
    primaryDateIso: primaryDate.iso,
    primaryDateDisplay: formatMembershipDisplayDate(primaryDate.iso),
    periodEndDisplay: formatMembershipDisplayDate(subscription.currentPeriodEnd),
  };
}
