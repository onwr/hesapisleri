import type { MembershipPaymentStatus, MembershipPeriod, SubscriptionStatus } from "@prisma/client";

export function getSubscriptionStatusLabel(status: SubscriptionStatus): string {
  const map: Record<SubscriptionStatus, string> = {
    TRIAL: "Deneme",
    ACTIVE: "Aktif",
    PAST_DUE: "Gecikmiş",
    GRACE_PERIOD: "Ek Süre",
    CANCEL_AT_PERIOD_END: "Dönem Sonu İptal",
    EXPIRED: "Süresi Doldu",
    CANCELLED: "İptal",
    SUSPENDED: "Askıda",
  };
  return map[status] ?? status;
}

export function getSubscriptionStatusClass(status: SubscriptionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    case "TRIAL":
      return "bg-blue-100 text-blue-700";
    case "PAST_DUE":
    case "GRACE_PERIOD":
      return "bg-amber-100 text-amber-700";
    case "CANCEL_AT_PERIOD_END":
      return "bg-orange-100 text-orange-700";
    case "EXPIRED":
    case "CANCELLED":
      return "bg-rose-100 text-rose-700";
    case "SUSPENDED":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

export function getPaymentStatusLabel(status: MembershipPaymentStatus): string {
  const map: Record<MembershipPaymentStatus, string> = {
    CREATED: "Oluşturuldu",
    FORM_READY: "Form Hazır",
    PENDING: "Bekliyor",
    WAIT_CALLBACK: "Callback Bekleniyor",
    PAID: "Ödendi",
    FAILED: "Başarısız",
    UNKNOWN: "Bilinmiyor",
    CANCELLED: "İptal",
    PARTIALLY_REFUNDED: "Kısmi İade",
    REFUNDED: "İade Edildi",
  };
  return map[status] ?? status;
}

export function getPaymentStatusClass(status: MembershipPaymentStatus): string {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-700";
    case "FAILED":
      return "bg-rose-100 text-rose-700";
    case "PENDING":
    case "WAIT_CALLBACK":
      return "bg-amber-100 text-amber-700";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "bg-purple-100 text-purple-700";
    case "CANCELLED":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

export function getBillingIntervalLabel(interval: MembershipPeriod | null | undefined): string {
  if (!interval) return "—";
  const map: Record<MembershipPeriod, string> = {
    MONTHLY: "Aylık",
    QUARTERLY: "3 Aylık",
    SEMI_ANNUAL: "6 Aylık",
    YEARLY: "Yıllık",
  };
  return map[interval] ?? interval;
}

export function maskProviderRef(ref: string | null | undefined): string {
  if (!ref) return "—";
  if (ref.length <= 8) return "****";
  return ref.slice(0, 4) + "****" + ref.slice(-4);
}

export function formatMinor(minor: number | null | undefined, currency = "TRY"): string {
  if (minor == null) return "—";
  const amount = minor / 100;
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
