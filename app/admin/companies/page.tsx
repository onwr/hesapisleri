import { AdminCompaniesContent } from "@/components/admin/admin-companies-content";
import { getAdminCompanies, getAdminCompaniesSummary } from "@/lib/admin-service";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    membershipStatus?: string;
  }>;
};

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [companies, summary] = await Promise.all([
    getAdminCompanies({
      q: params.q,
      status: params.status,
      membershipStatus: params.membershipStatus,
    }),
    getAdminCompaniesSummary(),
  ]);

  return (
    <AdminCompaniesContent
      companies={companies}
      summary={summary}
      filters={{
        q: params.q,
        status: params.status,
        membershipStatus: params.membershipStatus,
      }}
    />
  );
}
