import { AdminMembershipAddonsContent } from "@/components/admin/admin-membership-addons-content";
import {
  countActiveAddOnFilters,
  getAddOnSummary,
  listAddOns,
  parseAddOnListFilters,
} from "@/lib/admin/addons";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAddOnsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseAddOnListFilters(params);
  const activeFilterCount = countActiveAddOnFilters(filters);

  const [list, summary] = await Promise.all([listAddOns(filters), getAddOnSummary()]);

  const entitlementOptions = Object.values(
    (await import("@/lib/billing/entitlements/entitlement-registry")).ENTITLEMENT_REGISTRY
  ).map((i) => ({ code: i.code, label: i.label }));

  return (
    <AdminMembershipAddonsContent
      list={list}
      summary={summary}
      filters={filters}
      activeFilterCount={activeFilterCount}
      entitlements={entitlementOptions}
    />
  );
}
