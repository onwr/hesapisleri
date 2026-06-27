import type { MembershipPeriod } from "@prisma/client";
import { percentChange } from "@/lib/dashboard-metrics";
import { getMembershipPeriodMonths } from "@/lib/membership-utils";
import { formatAdminMoney } from "@/lib/admin-utils";

export type AdminOverviewMetricGroup =
  | "companies"
  | "users"
  | "revenue"
  | "subscriptions";

export type AdminOverviewMetric = {
  key: string;
  group: AdminOverviewMetricGroup;
  label: string;
  description: string;
  value: number;
  formattedValue: string;
  previousValue: number;
  changeValue: number;
  changePercent: number;
  comparisonLabel: string;
  href: string;
  currency?: string;
};

export const ADMIN_OVERVIEW_METRIC_DEFINITIONS = {
  companies: {
    total: "Platformdaki tüm firmalar (silinmiş kayıt yok).",
    active:
      "Firma durumu ACTIVE; askıya alınmamış ve platform erişimi açık.",
    newInPeriod: "Seçilen tarih aralığında oluşturulan firmalar.",
    trial: "Abonelik durumu TRIAL olan firmalar.",
    paid: "ACTIVE veya CANCEL_AT_PERIOD_END ücretli aboneliğe sahip firmalar.",
    pastDue: "Abonelik durumu PAST_DUE veya GRACE_PERIOD olan firmalar.",
    paymentOverdue: "Üyelik ödemesi gecikmiş veya son ödeme başarısız firmalar.",
    cancelled: "Abonelik durumu CANCELLED veya EXPIRED olan firmalar.",
  },
  users: {
    total: "Tüm kullanıcı hesapları.",
    active: "Hesap durumu ACTIVE olan kullanıcılar.",
    loggedInPeriod:
      "Seçilen dönemde en az bir kez giriş yapan benzersiz kullanıcılar.",
    newInPeriod: "Seçilen dönemde oluşturulan kullanıcılar.",
  },
  revenue: {
    collected:
      "Yalnız PAID durumundaki başarılı üyelik ödemeleri; iade ve başarısız ödemeler hariç.",
    mrr: "Aktif ücretli aboneliklerin aylık karşılığı; trial ve iptal hariç.",
    arr: "MRR × 12 tahmini yıllık tekrarlayan gelir.",
    refunded: "Seçilen dönemde iade edilen ödeme tutarları.",
    failed: "Seçilen dönemde başarısız ödeme tutarları.",
  },
  subscriptions: {
    active: "ACTIVE veya CANCEL_AT_PERIOD_END abonelikler.",
    trial: "TRIAL abonelikler.",
    pastDue: "PAST_DUE veya GRACE_PERIOD abonelikler.",
    cancelled: "CANCELLED veya EXPIRED abonelikler.",
    startedInPeriod: "Seçilen dönemde oluşturulan abonelikler.",
    endedInPeriod:
      "Seçilen dönemde iptal edilen veya süresi dolan abonelikler.",
  },
} as const;

export function buildMetric(input: {
  key: string;
  group: AdminOverviewMetricGroup;
  label: string;
  description: string;
  value: number;
  previousValue: number;
  format?: "number" | "money";
  currency?: string;
  href: string;
  comparisonLabel?: string;
}): AdminOverviewMetric {
  const changeValue = input.value - input.previousValue;
  const formattedValue =
    input.format === "money"
      ? formatAdminMoney(input.value)
      : String(input.value);

  return {
    key: input.key,
    group: input.group,
    label: input.label,
    description: input.description,
    value: input.value,
    formattedValue,
    previousValue: input.previousValue,
    changeValue,
    changePercent: percentChange(input.value, input.previousValue),
    comparisonLabel: input.comparisonLabel ?? "önceki döneme göre",
    href: input.href,
    currency: input.currency,
  };
}

export function subscriptionToMonthlyMinor(input: {
  billingInterval: MembershipPeriod | null;
  lockedPriceMinor: number | null;
  monthlyEquivalentMinor?: number | null;
  amountMinor?: number | null;
}) {
  if (input.monthlyEquivalentMinor && input.monthlyEquivalentMinor > 0) {
    return input.monthlyEquivalentMinor;
  }

  const totalMinor =
    input.lockedPriceMinor ?? input.amountMinor ?? input.monthlyEquivalentMinor ?? 0;

  if (!totalMinor || !input.billingInterval) {
    return 0;
  }

  return Math.round(totalMinor / getMembershipPeriodMonths(input.billingInterval));
}

export function sumCurrencyAmounts(
  rows: Array<{ currency: string; amount: number }>
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const currency = row.currency || "TRY";
    totals.set(currency, (totals.get(currency) ?? 0) + row.amount);
  }

  return [...totals.entries()].map(([currency, amount]) => ({
    currency,
    amount: Math.round(amount * 100) / 100,
  }));
}

export function formatCurrencyTotals(
  totals: Array<{ currency: string; amount: number }>
) {
  if (totals.length === 0) return formatAdminMoney(0);
  return totals
    .map((item) =>
      item.currency === "TRY"
        ? formatAdminMoney(item.amount)
        : `${item.amount.toFixed(2)} ${item.currency}`
    )
    .join(" · ");
}
