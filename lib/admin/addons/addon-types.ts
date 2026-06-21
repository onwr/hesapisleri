export const ADDON_PAGE_SIZE = 20;

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
};

export function parseAddOnListFilters(
  params: Record<string, string | string[] | undefined>
): AddOnListFilters {
  const pick = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Number(pick("page") ?? "1");
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
    page: Number.isFinite(page) && page > 0 ? page : 1,
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
  return count;
}
