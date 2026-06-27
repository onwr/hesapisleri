import type { AddOnListFilters } from "@/lib/admin/addons/addon-types";
import { DEFAULT_ADDON_PAGE_SIZE } from "@/lib/admin/addons/addon-types";
import { parseAddOnListFilters as parseFromTypes } from "@/lib/admin/addons/addon-types";

export function parseAddOnApiFilters(searchParams: URLSearchParams): AddOnListFilters {
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return parseFromTypes(params);
}

export { DEFAULT_ADDON_PAGE_SIZE };
