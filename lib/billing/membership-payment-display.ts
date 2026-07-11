import type { MembershipPaymentStatus } from "@prisma/client";

type MembershipPaymentAmountSource = {
  amount: { toString(): string } | number;
  amountMinor?: number | null;
};

/** Canonical müşteri ödeme tutarı — minor-unit kaynağını tercih eder. */
export function resolveMembershipPaymentAmount(
  payment: MembershipPaymentAmountSource
): number {
  if (
    payment.amountMinor != null &&
    Number.isFinite(payment.amountMinor) &&
    payment.amountMinor >= 0
  ) {
    return payment.amountMinor / 100;
  }

  return Number(payment.amount);
}

type PaidPaymentPickSource = {
  status: MembershipPaymentStatus;
  paidAt: Date | null;
  createdAt: Date;
};

/** Son başarılı ödeme — paidAt öncelikli, yoksa createdAt. */
export function pickLatestPaidMembershipPayment<T extends PaidPaymentPickSource>(
  payments: T[]
): T | null {
  const paid = payments.filter((payment) => payment.status === "PAID");
  if (paid.length === 0) return null;

  return paid.sort((a, b) => {
    const aTime = (a.paidAt ?? a.createdAt).getTime();
    const bTime = (b.paidAt ?? b.createdAt).getTime();
    return bTime - aTime;
  })[0]!;
}
