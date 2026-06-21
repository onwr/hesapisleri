import type { CampaignListFilters, CouponListFilters } from "@/lib/admin/promotions/promotion-types";

function pickParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseCampaignListFilters(
  params: Record<string, string | string[] | undefined>
): CampaignListFilters {
  return {
    q: pickParam(params, "q"),
    status: pickParam(params, "status") as CampaignListFilters["status"],
    discountType: pickParam(params, "discountType") as CampaignListFilters["discountType"],
    planId: pickParam(params, "planId"),
    interval: pickParam(params, "interval") as CampaignListFilters["interval"],
    autoApply: pickParam(params, "autoApply") as CampaignListFilters["autoApply"],
    stackable: pickParam(params, "stackable") as CampaignListFilters["stackable"],
    renewalAllowed: pickParam(params, "renewalAllowed") as CampaignListFilters["renewalAllowed"],
    firstPaymentOnly: pickParam(params, "firstPaymentOnly") as CampaignListFilters["firstPaymentOnly"],
    companyScoped: pickParam(params, "companyScoped") as CampaignListFilters["companyScoped"],
    partnerScoped: pickParam(params, "partnerScoped") as CampaignListFilters["partnerScoped"],
    startsFrom: pickParam(params, "startsFrom"),
    startsTo: pickParam(params, "startsTo"),
    endsFrom: pickParam(params, "endsFrom"),
    endsTo: pickParam(params, "endsTo"),
    sort: (pickParam(params, "sort") as CampaignListFilters["sort"]) ?? "startsAt",
    order: (pickParam(params, "order") as CampaignListFilters["order"]) ?? "desc",
    page: Math.max(1, Number(pickParam(params, "page") ?? 1) || 1),
  };
}

export function parseCouponListFilters(
  params: Record<string, string | string[] | undefined>
): CouponListFilters {
  return {
    q: pickParam(params, "q"),
    status: pickParam(params, "status") as CouponListFilters["status"],
    discountType: pickParam(params, "discountType") as CouponListFilters["discountType"],
    planId: pickParam(params, "planId"),
    interval: pickParam(params, "interval") as CouponListFilters["interval"],
    firstPaymentOnly: pickParam(params, "firstPaymentOnly") as CouponListFilters["firstPaymentOnly"],
    renewalAllowed: pickParam(params, "renewalAllowed") as CouponListFilters["renewalAllowed"],
    usageStatus: pickParam(params, "usageStatus") as CouponListFilters["usageStatus"],
    expiresFrom: pickParam(params, "expiresFrom"),
    expiresTo: pickParam(params, "expiresTo"),
    createdFrom: pickParam(params, "createdFrom"),
    createdTo: pickParam(params, "createdTo"),
    sort: (pickParam(params, "sort") as CouponListFilters["sort"]) ?? "code",
    order: (pickParam(params, "order") as CouponListFilters["order"]) ?? "asc",
    page: Math.max(1, Number(pickParam(params, "page") ?? 1) || 1),
  };
}

export function countActiveCampaignFilters(filters: CampaignListFilters) {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.discountType) count += 1;
  if (filters.planId) count += 1;
  if (filters.interval) count += 1;
  if (filters.autoApply) count += 1;
  if (filters.stackable) count += 1;
  if (filters.renewalAllowed) count += 1;
  if (filters.firstPaymentOnly) count += 1;
  if (filters.companyScoped) count += 1;
  if (filters.partnerScoped) count += 1;
  if (filters.startsFrom || filters.startsTo) count += 1;
  if (filters.endsFrom || filters.endsTo) count += 1;
  return count;
}

export function countActiveCouponFilters(filters: CouponListFilters) {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.discountType) count += 1;
  if (filters.planId) count += 1;
  if (filters.interval) count += 1;
  if (filters.firstPaymentOnly) count += 1;
  if (filters.renewalAllowed) count += 1;
  if (filters.usageStatus) count += 1;
  if (filters.expiresFrom || filters.expiresTo) count += 1;
  if (filters.createdFrom || filters.createdTo) count += 1;
  return count;
}

export const CAMPAIGN_STATUS_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "DRAFT", label: "Taslak" },
  { value: "SCHEDULED", label: "Zamanlanmış" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAUSED", label: "Duraklatılmış" },
  { value: "EXPIRED", label: "Süresi Doldu" },
  { value: "ARCHIVED", label: "Arşiv" },
] as const;

export const COUPON_STATUS_OPTIONS = [
  { value: "", label: "Tüm durumlar" },
  { value: "DRAFT", label: "Taslak" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAUSED", label: "Duraklatılmış" },
  { value: "EXPIRED", label: "Süresi Doldu" },
  { value: "ARCHIVED", label: "Arşiv" },
] as const;

export const DISCOUNT_TYPE_OPTIONS = [
  { value: "", label: "Tüm indirim tipleri" },
  { value: "PERCENTAGE", label: "Yüzde" },
  { value: "FIXED_AMOUNT", label: "Sabit Tutar" },
  { value: "OVERRIDE_PRICE", label: "Fiyat Override" },
] as const;

export const INTERVAL_FILTER_OPTIONS = [
  { value: "", label: "Tüm dönemler" },
  { value: "MONTHLY", label: "Aylık" },
  { value: "QUARTERLY", label: "3 Aylık" },
  { value: "SEMI_ANNUAL", label: "6 Aylık" },
  { value: "YEARLY", label: "Yıllık" },
] as const;

export const BOOL_FILTER_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "true", label: "Evet" },
  { value: "false", label: "Hayır" },
] as const;

export const COUPON_USAGE_STATUS_OPTIONS = [
  { value: "", label: "Tüm kullanım durumları" },
  { value: "available", label: "Kullanılabilir" },
  { value: "limit_reached", label: "Limit doldu" },
  { value: "expired", label: "Süresi doldu" },
] as const;

export function getCampaignStatusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Taslak",
    SCHEDULED: "Zamanlanmış",
    ACTIVE: "Aktif",
    PAUSED: "Duraklatılmış",
    EXPIRED: "Süresi Doldu",
    ARCHIVED: "Arşiv",
  };
  return map[status] ?? status;
}

export function getCouponStatusLabel(status: string) {
  return getCampaignStatusLabel(status);
}

export function getCampaignStatusBadgeClass(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    SCHEDULED: "bg-blue-100 text-blue-700",
    ACTIVE: "bg-emerald-100 text-emerald-700",
    PAUSED: "bg-amber-100 text-amber-800",
    EXPIRED: "bg-slate-200 text-slate-600",
    ARCHIVED: "bg-slate-100 text-slate-500",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

export function getConflictSeverityClass(severity: string) {
  if (severity === "BLOCKING") return "border-rose-200 bg-rose-50 text-rose-900";
  if (severity === "WARNING") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-blue-200 bg-blue-50 text-blue-900";
}
