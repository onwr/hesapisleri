export const DEFAULT_APPLICATION_PAGE_SIZE = 25;
export const APPLICATION_PAGE_SIZES = [25, 50, 100] as const;

export type ApplicationListFilters = {
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page: number;
  pageSize: number;
};

export function parseApplicationListFilters(
  params: Record<string, string | string[] | undefined>
): ApplicationListFilters {
  const rawPage = Number(params.page ?? 1);
  const rawSize = Number(params.pageSize ?? DEFAULT_APPLICATION_PAGE_SIZE);
  return {
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
    sort: typeof params.sort === "string" ? params.sort : "created_desc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: APPLICATION_PAGE_SIZES.includes(rawSize as (typeof APPLICATION_PAGE_SIZES)[number])
      ? rawSize
      : DEFAULT_APPLICATION_PAGE_SIZE,
  };
}
