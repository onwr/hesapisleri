import type {
  MembershipPeriod,
  SubscriptionStatus,
} from "@prisma/client";
import type { ResolvedSubscriptionPrice } from "@/lib/billing/price-resolution-service";
import { getSubscriptionStatusLabel } from "@/lib/membership-utils";
import { formatMembershipPeriod } from "@/lib/membership-utils";

export type AdminSubscriptionPriceSourceLabel =
  | "STANDARD_PLAN"
  | "CAMPAIGN"
  | "COUPON"
  | "PARTNER"
  | "COMPANY_OVERRIDE"
  | "GRANDFATHERED"
  | "MANUAL_ADMIN"
  | "LEGACY"
  | "UNKNOWN";

const PRICE_SOURCE_LABELS: Record<AdminSubscriptionPriceSourceLabel, string> = {
  STANDARD_PLAN: "Standart Plan Fiyatı",
  CAMPAIGN: "Kampanya",
  COUPON: "Kupon",
  PARTNER: "Partner İndirimi",
  COMPANY_OVERRIDE: "Özel Firma Fiyatı",
  GRANDFATHERED: "Grandfathered",
  MANUAL_ADMIN: "Manuel Admin",
  LEGACY: "Legacy",
  UNKNOWN: "Bilinmiyor",
};

export function mapResolvedPriceSource(
  source: ResolvedSubscriptionPrice["priceSource"],
  appliedDiscounts: ResolvedSubscriptionPrice["appliedDiscounts"] = []
): { label: AdminSubscriptionPriceSourceLabel; description: string } {
  if (source === "GRANDFATHERED") {
    return {
      label: "GRANDFATHERED",
      description: "Abonelik fiyat kilidi (grandfathered) aktif.",
    };
  }
  if (source === "COMPANY_OVERRIDE") {
    return {
      label: "COMPANY_OVERRIDE",
      description: "Firma özel fiyat override kaydı uygulanıyor.",
    };
  }
  if (source === "LEGACY_PLAN_COLUMN") {
    return { label: "LEGACY", description: "Legacy plan kolon fiyatı." };
  }

  const campaign = appliedDiscounts.find((d) => d.type === "CAMPAIGN");
  if (campaign) {
    return {
      label: "CAMPAIGN",
      description: campaign.label,
    };
  }

  const coupon = appliedDiscounts.find((d) => d.type === "COUPON");
  if (coupon) {
    return { label: "COUPON", description: coupon.label };
  }

  const partner = appliedDiscounts.find((d) => d.type === "PARTNER");
  if (partner) {
    return { label: "PARTNER", description: partner.label };
  }

  return {
    label: "STANDARD_PLAN",
    description: "Güncel plan fiyat versiyonu.",
  };
}

export function getAdminPriceSourceLabel(label: AdminSubscriptionPriceSourceLabel) {
  return PRICE_SOURCE_LABELS[label];
}

export function getSubscriptionStatusBadgeClass(status: SubscriptionStatus) {
  if (status === "ACTIVE" || status === "TRIAL")
    return "bg-emerald-100 text-emerald-700";
  if (status === "PAST_DUE" || status === "GRACE_PERIOD")
    return "bg-orange-100 text-orange-700";
  if (status === "CANCEL_AT_PERIOD_END") return "bg-amber-100 text-amber-800";
  if (status === "SUSPENDED" || status === "EXPIRED")
    return "bg-rose-100 text-rose-700";
  if (status === "CANCELLED") return "bg-slate-100 text-slate-600";
  return "bg-slate-100 text-slate-700";
}

export function getSubscriptionStatusUiLabel(status: SubscriptionStatus) {
  const labels: Partial<Record<SubscriptionStatus, string>> = {
    PAST_DUE: "Ödeme Gecikti",
  };
  return labels[status] ?? getSubscriptionStatusLabel(status);
}

export function formatBillingInterval(period: MembershipPeriod | null | undefined) {
  if (!period) return "—";
  return formatMembershipPeriod(period);
}

export const ADMIN_SUBSCRIPTION_PAGE_SIZE = 30;

export const MAX_TRIAL_EXTENSION_DAYS = 90;

export type AdminSubscriptionListFilters = {
  q?: string;
  planId?: string;
  interval?: MembershipPeriod;
  status?: SubscriptionStatus;
  autoRenew?: "true" | "false";
  trial?: "true" | "false";
  grace?: "true" | "false";
  hasPaymentMethod?: "true" | "false";
  partnerId?: string;
  partnerScope?: "WITH" | "WITHOUT";
  priceSource?: string;
  nextBillingFrom?: string;
  nextBillingTo?: string;
  periodStartFrom?: string;
  periodStartTo?: string;
  periodEndFrom?: string;
  periodEndTo?: string;
  sort?: "nextBilling" | "periodEnd" | "created" | "company";
  order?: "asc" | "desc";
  page?: number;
};

export function parseAdminSubscriptionFilters(
  params: Record<string, string | string[] | undefined>
): AdminSubscriptionListFilters {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    q: pick("q"),
    planId: pick("planId"),
    interval: pick("interval") as MembershipPeriod | undefined,
    status: pick("status") as SubscriptionStatus | undefined,
    autoRenew: pick("autoRenew") as "true" | "false" | undefined,
    trial: pick("trial") as "true" | "false" | undefined,
    grace: pick("grace") as "true" | "false" | undefined,
    hasPaymentMethod: pick("hasPaymentMethod") as "true" | "false" | undefined,
    partnerId: pick("partnerId"),
    partnerScope: pick("partnerScope") as "WITH" | "WITHOUT" | undefined,
    priceSource: pick("priceSource"),
    nextBillingFrom: pick("nextBillingFrom"),
    nextBillingTo: pick("nextBillingTo"),
    periodStartFrom: pick("periodStartFrom"),
    periodStartTo: pick("periodStartTo"),
    periodEndFrom: pick("periodEndFrom"),
    periodEndTo: pick("periodEndTo"),
    sort: (pick("sort") as AdminSubscriptionListFilters["sort"]) ?? "nextBilling",
    order: (pick("order") as AdminSubscriptionListFilters["order"]) ?? "asc",
    page: Math.max(1, Number(pick("page") ?? 1) || 1),
  };
}

export const ADMIN_PRICE_SOURCE_FILTER_OPTIONS = [
  { value: "", label: "Tüm fiyat kaynakları" },
  { value: "STANDARD_PLAN", label: "Standart Plan" },
  { value: "CAMPAIGN", label: "Kampanya" },
  { value: "COUPON", label: "Kupon" },
  { value: "PARTNER", label: "Partner" },
  { value: "COMPANY_OVERRIDE", label: "Özel Firma Fiyatı" },
  { value: "GRANDFATHERED", label: "Grandfathered" },
  { value: "MANUAL_ADMIN", label: "Manuel" },
  { value: "LEGACY", label: "Legacy" },
] as const;

export const ADMIN_PARTNER_SCOPE_OPTIONS = [
  { value: "", label: "Partner (tümü)" },
  { value: "WITH", label: "Partnerli" },
  { value: "WITHOUT", label: "Partnersiz" },
] as const;

export function countActiveSubscriptionFilters(filters: AdminSubscriptionListFilters) {
  let count = 0;
  if (filters.planId) count += 1;
  if (filters.interval) count += 1;
  if (filters.status) count += 1;
  if (filters.autoRenew) count += 1;
  if (filters.trial) count += 1;
  if (filters.grace) count += 1;
  if (filters.hasPaymentMethod) count += 1;
  if (filters.partnerId) count += 1;
  if (filters.partnerScope) count += 1;
  if (filters.priceSource) count += 1;
  if (filters.nextBillingFrom || filters.nextBillingTo) count += 1;
  if (filters.periodStartFrom || filters.periodStartTo) count += 1;
  if (filters.periodEndFrom || filters.periodEndTo) count += 1;
  return count;
}
