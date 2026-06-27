import type { Prisma } from "@prisma/client";

/**
 * Trial kayıtları legacy `provider` string alanında "TRIAL" olarak tutulur.
 * PaymentProvider enum'unda TRIAL yoktur.
 * PENDING + provider=TRIAL + gerçek tahsilat yok → tahsilata dahil edilmez.
 */
export const TRIAL_PLACEHOLDER_PROVIDER = "TRIAL";

export const IS_TRIAL_PLACEHOLDER_PAYMENT: Prisma.MembershipPaymentWhereInput = {
  provider: TRIAL_PLACEHOLDER_PROVIDER,
};

export const IS_NOT_TRIAL_PLACEHOLDER: Prisma.MembershipPaymentWhereInput = {
  NOT: IS_TRIAL_PLACEHOLDER_PAYMENT,
};

/** Gerçek ücretli tahsilat: PAID, trial placeholder değil, pozitif tutar */
export const REVENUE_ELIGIBLE_WHERE: Prisma.MembershipPaymentWhereInput = {
  status: "PAID",
  ...IS_NOT_TRIAL_PLACEHOLDER,
  OR: [
    { amountMinor: { gt: 0 } },
    { amountMinor: null, amount: { gt: 0 } },
  ],
};

export const COLLECTION_METRIC_POLICY =
  "Tahsilat metrikleri yalnızca status=PAID, provider≠TRIAL ve amountMinor>0 olan gerçek ücretli ödemeleri sayar. Para birimleri ayrı toplanır.";

export const REFUND_METRIC_POLICY =
  "İade metrikleri yalnızca PaymentRefund.status=SUCCEEDED ve completedAt dolu kayıtlardan hesaplanır; pending/failed refund tahsilata veya iade toplamına girmez.";
