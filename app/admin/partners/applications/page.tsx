import {
  getPartnerApplicationSummary,
  listPartnerApplicationsAdmin,
  parseApplicationListFilters,
} from "@/lib/admin/partner-applications";
import { AdminPartnerApplicationsContent } from "@/components/admin/admin-partner-applications-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPartnerApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseApplicationListFilters(params);

  const [summary, list] = await Promise.all([
    getPartnerApplicationSummary(),
    listPartnerApplicationsAdmin(filters),
  ]);

  return <AdminPartnerApplicationsContent summary={summary} list={list} filters={filters} />;
}
