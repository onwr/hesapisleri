import { AdminCompaniesListContent } from "@/components/admin/companies/admin-companies-list-content";
import { parseAdminCompanyFilters } from "@/lib/admin/companies/admin-company-filter-utils";
import {
  listAdminCompaniesPaginated,
  listAdminCompanyPlans,
} from "@/lib/admin/companies/admin-company-list-service";
import { getAdminCompanyListMetrics } from "@/lib/admin/companies/admin-company-metric-service";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseAdminCompanyFilters(params);

  const [list, metrics, plans] = await Promise.all([
    listAdminCompaniesPaginated(filters),
    getAdminCompanyListMetrics(),
    listAdminCompanyPlans(),
  ]);

  return (
    <AdminCompaniesListContent
      list={list}
      metrics={metrics}
      filters={filters}
      plans={plans}
    />
  );
}
