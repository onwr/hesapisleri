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

export default async function AdminMembershipAddonsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseAddOnListFilters(params);

  const [list, summary] = await Promise.all([listAddOns(filters), getAddOnSummary()]);

  return (
    <AdminMembershipAddonsContent list={list} summary={summary} filters={filters} />
  );
}
