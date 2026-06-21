import type {
  MembershipPeriod,
  MembershipPaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { startOfDay } from "@/lib/calendar-utils";

export type MembershipSubscriptionLike = {
  status: SubscriptionStatus;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  trialEndsAt?: Date | string | null;
};

const PERIOD_LABELS: Record<MembershipPeriod, string> = {
  MONTHLY: "Aylık",
  QUARTERLY: "3 Aylık",
  SEMI_ANNUAL: "6 Aylık",
  YEARLY: "Yıllık",
};

const PERIOD_MONTHS: Record<MembershipPeriod, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  YEARLY: 12,
};

const PAYMENT_STATUS_LABELS: Record<MembershipPaymentStatus, string> = {
  CREATED: "Oluşturuldu",
  FORM_READY: "Form Hazır",
  PENDING: "Bekliyor",
  WAIT_CALLBACK: "PayTR Bildirimi Bekleniyor",
  PAID: "Ödendi",
  FAILED: "Başarısız",
  UNKNOWN: "Mutabakat Bekliyor",
  CANCELLED: "İptal",
  PARTIALLY_REFUNDED: "Kısmi İade",
  REFUNDED: "İade",
};

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  TRIAL: "Deneme",
  ACTIVE: "Aktif",
  PAST_DUE: "Ödeme Gecikti",
  GRACE_PERIOD: "Ek Süre",
  CANCEL_AT_PERIOD_END: "Dönem Sonunda İptal",
  EXPIRED: "Süresi Doldu",
  CANCELLED: "İptal",
  SUSPENDED: "Askıda",
};

export function getMembershipPeriodLabel(period: MembershipPeriod) {
  return PERIOD_LABELS[period];
}

export function formatMembershipPeriod(period: MembershipPeriod) {
  return getMembershipPeriodLabel(period);
}

export function getMembershipPeriodMonths(period: MembershipPeriod) {
  return PERIOD_MONTHS[period];
}

export function getMembershipPaymentStatusLabel(status: MembershipPaymentStatus) {
  return PAYMENT_STATUS_LABELS[status];
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus) {
  return SUBSCRIPTION_STATUS_LABELS[status];
}

export function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);

  if (result.getDate() < day) {
    result.setDate(0);
  }

  return result;
}

export function resolveMembershipPeriodStart(
  currentPeriodEnd: Date | null | undefined,
  referenceDate = new Date()
) {
  if (currentPeriodEnd && currentPeriodEnd.getTime() > referenceDate.getTime()) {
    return new Date(currentPeriodEnd);
  }

  return new Date(referenceDate);
}

export function calculateMembershipEndDate(startDate: Date, period: MembershipPeriod) {
  return addMonths(startDate, getMembershipPeriodMonths(period));
}

export function calculateMembershipAmount(
  plan: {
    monthlyPrice: number | { toString(): string };
    quarterlyPrice: number | { toString(): string };
    semiAnnualPrice: number | { toString(): string };
    yearlyPrice: number | { toString(): string };
  },
  period: MembershipPeriod
) {
  switch (period) {
    case "MONTHLY":
      return Number(plan.monthlyPrice);
    case "QUARTERLY":
      return Number(plan.quarterlyPrice);
    case "SEMI_ANNUAL":
      return Number(plan.semiAnnualPrice);
    case "YEARLY":
      return Number(plan.yearlyPrice);
    default:
      return Number(plan.monthlyPrice);
  }
}

export function getRemainingMembershipDays(
  currentPeriodEnd: Date | null | undefined,
  referenceDate = new Date()
) {
  if (!currentPeriodEnd) return 0;

  const diff =
    startOfDay(currentPeriodEnd).getTime() - startOfDay(referenceDate).getTime();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function getMembershipStatus(
  subscription: MembershipSubscriptionLike,
  referenceDate = new Date()
) {
  const now = referenceDate.getTime();
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null;
  const trialEnd = subscription.trialEndsAt
    ? new Date(subscription.trialEndsAt).getTime()
    : null;

  if (subscription.status === "CANCELLED") {
    return "CANCELLED" as const;
  }

  if (subscription.status === "SUSPENDED") {
    return "SUSPENDED" as const;
  }

  if (subscription.status === "PAST_DUE") {
    return "PAST_DUE" as const;
  }

  if (subscription.status === "GRACE_PERIOD") {
    return "GRACE_PERIOD" as const;
  }

  if (subscription.status === "CANCEL_AT_PERIOD_END") {
    return "CANCEL_AT_PERIOD_END" as const;
  }

  if (
    subscription.status === "TRIAL" ||
    (trialEnd && trialEnd > now && subscription.status !== "ACTIVE")
  ) {
    if (trialEnd && trialEnd <= now) {
      return "EXPIRED" as const;
    }
    return "TRIAL" as const;
  }

  if (periodEnd && periodEnd > now) {
    return "ACTIVE" as const;
  }

  return "EXPIRED" as const;
}

export function isMembershipExpired(
  subscription: MembershipSubscriptionLike,
  referenceDate = new Date()
) {
  return getMembershipStatus(subscription, referenceDate) === "EXPIRED";
}

export function shouldNotifyMembershipExpiring(
  currentPeriodEnd: Date | null | undefined,
  daysBefore: number,
  referenceDate = new Date()
) {
  if (!currentPeriodEnd) return false;

  const remaining = getRemainingMembershipDays(currentPeriodEnd, referenceDate);
  return remaining > 0 && remaining <= daysBefore;
}

export const MEMBERSHIP_PERIOD_OPTIONS: Array<{
  period: MembershipPeriod;
  label: string;
  months: number;
  badge?: string;
}> = [
  { period: "MONTHLY", label: "Aylık", months: 1 },
  { period: "QUARTERLY", label: "3 Aylık", months: 3, badge: "Avantajlı" },
  { period: "SEMI_ANNUAL", label: "6 Aylık", months: 6, badge: "Popüler" },
  { period: "YEARLY", label: "Yıllık", months: 12, badge: "En avantajlı" },
];

export function getPaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "BANK_TRANSFER":
      return "Banka Havalesi";
    case "MANUAL":
      return "Manuel Onay";
    case "CREDIT_CARD":
      return "Kredi Kartı";
    case "PAYTR":
      return "PayTR";
    case "IYZICO":
      return "iyzico";
    default:
      return method ?? "—";
  }
}
