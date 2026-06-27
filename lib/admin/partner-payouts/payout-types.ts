export const DEFAULT_PAYOUT_PAGE_SIZE = 25;
export const PAYOUT_PAGE_SIZES = [25, 50, 100] as const;

export type PayoutListFilters = {
  q?: string;
  status?: string;
  currency?: string;
  periodFrom?: string;
  periodTo?: string;
  paidFrom?: string;
  paidTo?: string;
  hasIssue?: boolean;
  sort?: string;
  page: number;
  pageSize: number;
};

export function parsePayoutListFilters(
  params: Record<string, string | string[] | undefined>
): PayoutListFilters {
  const rawPage = Number(params.page ?? 1);
  const rawSize = Number(params.pageSize ?? DEFAULT_PAYOUT_PAGE_SIZE);
  return {
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? params.status : undefined,
    currency: typeof params.currency === "string" ? params.currency : undefined,
    periodFrom: typeof params.periodFrom === "string" ? params.periodFrom : undefined,
    periodTo: typeof params.periodTo === "string" ? params.periodTo : undefined,
    paidFrom: typeof params.paidFrom === "string" ? params.paidFrom : undefined,
    paidTo: typeof params.paidTo === "string" ? params.paidTo : undefined,
    hasIssue:
      params.hasIssue === "1" || params.hasIssue === "true"
        ? true
        : params.hasIssue === "0" || params.hasIssue === "false"
          ? false
          : undefined,
    sort: typeof params.sort === "string" ? params.sort : "created_desc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    pageSize: PAYOUT_PAGE_SIZES.includes(rawSize as (typeof PAYOUT_PAGE_SIZES)[number])
      ? rawSize
      : DEFAULT_PAYOUT_PAGE_SIZE,
  };
}

export type CurrencyAmountMap = Record<string, { count: number; amount: number }>;

export function emptyCurrencyMap(): CurrencyAmountMap {
  return {};
}

export function addToCurrencyMap(
  map: CurrencyAmountMap,
  currency: string,
  amount: number
) {
  const cur = currency || "TRY";
  if (!map[cur]) map[cur] = { count: 0, amount: 0 };
  map[cur].count += 1;
  map[cur].amount += amount;
}

export type EligibleEarningFilters = {
  partnerId: string;
  currency?: string;
  dateFrom?: string;
  dateTo?: string;
  company?: string;
  amountMin?: number;
  amountMax?: number;
};

export function parseEligibleEarningFilters(
  params: Record<string, string | string[] | undefined>
): EligibleEarningFilters | null {
  const partnerId = typeof params.partnerId === "string" ? params.partnerId.trim() : "";
  if (!partnerId) return null;

  const rawMin = params.amountMin != null ? Number(params.amountMin) : undefined;
  const rawMax = params.amountMax != null ? Number(params.amountMax) : undefined;

  return {
    partnerId,
    currency: typeof params.currency === "string" ? params.currency : undefined,
    dateFrom: typeof params.dateFrom === "string" ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === "string" ? params.dateTo : undefined,
    company: typeof params.company === "string" ? params.company : undefined,
    amountMin: rawMin != null && Number.isFinite(rawMin) ? rawMin : undefined,
    amountMax: rawMax != null && Number.isFinite(rawMax) ? rawMax : undefined,
  };
}
