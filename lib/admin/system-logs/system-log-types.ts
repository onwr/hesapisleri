export const SYSTEM_LOG_PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_SYSTEM_LOG_PAGE_SIZE = 25;
export const MIN_SEARCH_LENGTH = 2;

export type SystemLogSource = "ADMIN" | "TENANT" | "SYSTEM" | "CRON";
export type SystemLogScope = "structured" | "legacy";
export type SystemLogResult = "success" | "error" | "unknown";

export type SystemLogSort =
  | "created_desc"
  | "created_asc"
  | "action_asc"
  | "action_desc"
  | "module_asc"
  | "module_desc";

export type SystemLogListFilters = {
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  module?: string;
  entityType?: string;
  actorId?: string;
  companyId?: string;
  result?: SystemLogResult;
  source?: SystemLogSource;
  scope?: SystemLogScope;
  sort: SystemLogSort;
  page: number;
  pageSize: number;
};

export function parseSystemLogListFilters(
  params: Record<string, string | string[] | undefined>
): SystemLogListFilters {
  const rawPage = Number(params.page ?? 1);
  const rawSize = Number(params.pageSize ?? DEFAULT_SYSTEM_LOG_PAGE_SIZE);

  const resultRaw = typeof params.result === "string" ? params.result : undefined;
  const sourceRaw = typeof params.source === "string" ? params.source : undefined;
  const scopeRaw = typeof params.scope === "string" ? params.scope : undefined;
  const sortRaw = typeof params.sort === "string" ? params.sort : "created_desc";

  const validSorts: SystemLogSort[] = [
    "created_desc",
    "created_asc",
    "action_asc",
    "action_desc",
    "module_asc",
    "module_desc",
  ];

  const validResults: SystemLogResult[] = ["success", "error", "unknown"];
  const validSources: SystemLogSource[] = ["ADMIN", "TENANT", "SYSTEM", "CRON"];
  const validScopes: SystemLogScope[] = ["structured", "legacy"];

  return {
    q: typeof params.q === "string" && params.q.trim().length >= MIN_SEARCH_LENGTH ? params.q.trim() : undefined,
    dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
    action: typeof params.action === "string" && params.action !== "ALL" ? params.action : undefined,
    module: typeof params.module === "string" && params.module !== "ALL" ? params.module : undefined,
    entityType:
      typeof params.entityType === "string" && params.entityType !== "ALL" ? params.entityType : undefined,
    actorId: typeof params.actorId === "string" ? params.actorId : undefined,
    companyId: typeof params.companyId === "string" ? params.companyId : undefined,
    result: validResults.includes(resultRaw as SystemLogResult) ? (resultRaw as SystemLogResult) : undefined,
    source: validSources.includes(sourceRaw as SystemLogSource) ? (sourceRaw as SystemLogSource) : undefined,
    scope: validScopes.includes(scopeRaw as SystemLogScope) ? (scopeRaw as SystemLogScope) : undefined,
    sort: validSorts.includes(sortRaw as SystemLogSort) ? (sortRaw as SystemLogSort) : "created_desc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: SYSTEM_LOG_PAGE_SIZES.includes(rawSize as (typeof SYSTEM_LOG_PAGE_SIZES)[number])
      ? rawSize
      : DEFAULT_SYSTEM_LOG_PAGE_SIZE,
  };
}

export function buildSystemLogQueryString(filters: Partial<SystemLogListFilters>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}
