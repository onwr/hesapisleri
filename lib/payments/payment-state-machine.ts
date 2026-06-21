import "server-only";

import type { MembershipPaymentStatus, SubscriptionStatus } from "@prisma/client";

const PAYMENT_TRANSITIONS: Record<MembershipPaymentStatus, MembershipPaymentStatus[]> = {
  CREATED: ["FORM_READY", "CANCELLED", "FAILED"],
  FORM_READY: ["PENDING", "WAIT_CALLBACK", "FAILED", "CANCELLED"],
  PENDING: ["WAIT_CALLBACK", "PAID", "FAILED", "UNKNOWN", "CANCELLED"],
  WAIT_CALLBACK: ["PAID", "FAILED", "UNKNOWN"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  FAILED: ["PENDING", "CANCELLED"],
  UNKNOWN: ["WAIT_CALLBACK", "PAID", "FAILED", "CANCELLED"],
  CANCELLED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  REFUNDED: [],
};

const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ["ACTIVE", "EXPIRED", "CANCELLED"],
  ACTIVE: ["PAST_DUE", "CANCEL_AT_PERIOD_END", "CANCELLED", "SUSPENDED"],
  PAST_DUE: ["ACTIVE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"],
  GRACE_PERIOD: ["ACTIVE", "SUSPENDED", "EXPIRED"],
  CANCEL_AT_PERIOD_END: ["ACTIVE", "CANCELLED"],
  EXPIRED: ["ACTIVE", "SUSPENDED"],
  CANCELLED: ["ACTIVE"],
  SUSPENDED: ["ACTIVE", "EXPIRED"],
};

export function canTransitionPaymentStatus(from: MembershipPaymentStatus, to: MembershipPaymentStatus) {
  return from === to || PAYMENT_TRANSITIONS[from].includes(to);
}

export function assertPaymentTransition(from: MembershipPaymentStatus, to: MembershipPaymentStatus) {
  if (!canTransitionPaymentStatus(from, to)) {
    throw new Error(`Geçersiz ödeme durum geçişi: ${from} -> ${to}`);
  }
}

export function getStatusStepsBeforePaid(from: MembershipPaymentStatus) {
  if (from === "PAID" || from === "WAIT_CALLBACK" || from === "PENDING") {
    return [] as MembershipPaymentStatus[];
  }
  if (from === "FORM_READY") return ["WAIT_CALLBACK"] as MembershipPaymentStatus[];
  if (from === "CREATED") return ["FORM_READY", "WAIT_CALLBACK"] as MembershipPaymentStatus[];
  if (from === "UNKNOWN") return ["WAIT_CALLBACK"] as MembershipPaymentStatus[];
  return [] as MembershipPaymentStatus[];
}

export async function applyStatusStepsBeforePaid(
  tx: {
    membershipPayment: {
      update: (args: {
        where: { id: string };
        data: { status: MembershipPaymentStatus };
      }) => Promise<unknown>;
    };
  },
  paymentId: string,
  from: MembershipPaymentStatus
) {
  let status = from;
  for (const next of getStatusStepsBeforePaid(from)) {
    assertPaymentTransition(status, next);
    await tx.membershipPayment.update({
      where: { id: paymentId },
      data: { status: next },
    });
    status = next;
  }
  return status;
}

export function canTransitionSubscriptionStatus(from: SubscriptionStatus, to: SubscriptionStatus) {
  return from === to || SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

export function assertSubscriptionTransition(from: SubscriptionStatus, to: SubscriptionStatus) {
  if (!canTransitionSubscriptionStatus(from, to)) {
    throw new Error(`Geçersiz abonelik durum geçişi: ${from} -> ${to}`);
  }
}
