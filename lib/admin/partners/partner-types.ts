export const DEFAULT_PARTNER_PAGE_SIZE = 25;
export const PARTNER_PAGE_SIZES = [25, 50, 100] as const;

export type PartnerListFilters = {
  q?: string;
  status?: string;
  badgeType?: string;
  hasCompanies?: string;
  sort?: string;
  page: number;
  pageSize: number;
};

export function parsePartnerListFilters(
  params: Record<string, string | string[] | undefined>
): PartnerListFilters {
  const rawPage = Number(params.page ?? 1);
  const rawSize = Number(params.pageSize ?? DEFAULT_PARTNER_PAGE_SIZE);
  return {
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    badgeType: typeof params.badgeType === "string" ? params.badgeType : undefined,
    hasCompanies: typeof params.hasCompanies === "string" ? params.hasCompanies : undefined,
    sort: typeof params.sort === "string" ? params.sort : "created_desc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PARTNER_PAGE_SIZES.includes(rawSize as (typeof PARTNER_PAGE_SIZES)[number])
      ? rawSize
      : DEFAULT_PARTNER_PAGE_SIZE,
  };
}
