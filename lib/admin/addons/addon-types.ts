export const ADDON_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_ADDON_PAGE_SIZE = 25;

/** @deprecated use DEFAULT_ADDON_PAGE_SIZE */
export const ADDON_PAGE_SIZE = DEFAULT_ADDON_PAGE_SIZE;

export type AddOnListFilters = {
  q?: string;
  status?: string;
  type?: string;
  entitlementCode?: string;
  isPublic?: string;
  recurring?: string;
  priceMin?: string;
  priceMax?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: string;
  order?: string;
  page?: number;
  pageSize?: 25 | 50 | 100;
  issue?: string;
};

export function parseAddOnListFilters(
  params: Record<string, string | string[] | undefined>
): AddOnListFilters {
  const pick = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number(pick("page") ?? "1");
  const pageSizeRaw = Number(pick("pageSize") ?? DEFAULT_ADDON_PAGE_SIZE);
  const pageSize = ADDON_PAGE_SIZES.includes(pageSizeRaw as 25 | 50 | 100)
    ? (pageSizeRaw as 25 | 50 | 100)
    : DEFAULT_ADDON_PAGE_SIZE;

  return {
    q: pick("q"),
    status: pick("status"),
    type: pick("type"),
    entitlementCode: pick("entitlementCode"),
    isPublic: pick("isPublic"),
    recurring: pick("recurring"),
    priceMin: pick("priceMin"),
    priceMax: pick("priceMax"),
    createdFrom: pick("createdFrom"),
    createdTo: pick("createdTo"),
    sort: pick("sort"),
    order: pick("order"),
    issue: pick("issue"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize,
  };
}

export function countActiveAddOnFilters(filters: AddOnListFilters) {
  let count = 0;
  if (filters.q?.trim()) count += 1;
  if (filters.status) count += 1;
  if (filters.type) count += 1;
  if (filters.entitlementCode) count += 1;
  if (filters.isPublic) count += 1;
  if (filters.recurring) count += 1;
  if (filters.priceMin || filters.priceMax) count += 1;
  if (filters.createdFrom || filters.createdTo) count += 1;
  if (filters.issue) count += 1;
  return count;
}

export const ADDON_ISSUE_OPTIONS = [
  { value: "", label: "Tüm sorunlar" },
  { value: "ACTIVE_WITHOUT_PRICE", label: "Fiyat eksik" },
  { value: "PRICE_OVERLAP", label: "Fiyat çakışması" },
  { value: "PRICE_RESOLUTION_CONFLICT", label: "Çözümleme çakışması" },
  { value: "INVALID_PRICE", label: "Geçersiz fiyat" },
  { value: "CURRENCY_MISMATCH", label: "Para birimi uyumsuz" },
  { value: "UNKNOWN_ENTITLEMENT", label: "Bilinmeyen entitlement" },
  { value: "ENTITLEMENT_TYPE_MISMATCH", label: "Entitlement tip uyumsuz" },
  { value: "ARCHIVED_WITH_ACTIVE_SUBSCRIPTIONS", label: "Arşiv + aktif abonelik" },
  { value: "INVALID_QUANTITY", label: "Geçersiz miktar" },
] as const;
