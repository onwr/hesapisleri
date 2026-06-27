import type { CouponListFilters } from "@/lib/admin/promotions/promotion-types";
import { parseCouponListFilters } from "@/lib/admin/promotions/promotion-filter-utils";

export function parseCouponApiFilters(searchParams: URLSearchParams): CouponListFilters {
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return parseCouponListFilters(params);
}
