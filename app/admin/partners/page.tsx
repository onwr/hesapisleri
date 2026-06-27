import { AdminPartnersContent } from "@/components/admin/admin-partners-content";
import { getPartnerSummary, listPartners, parsePartnerListFilters } from "@/lib/admin/partners";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPartnersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parsePartnerListFilters(params);
  const [list, summary] = await Promise.all([listPartners(filters), getPartnerSummary()]);

  return <AdminPartnersContent list={list} summary={summary} filters={filters} />;
}
