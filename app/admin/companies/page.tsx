import { AdminCompaniesContent } from "@/components/admin/admin-companies-content";
import { getAdminCompanies } from "@/lib/admin-service";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    membershipStatus?: string;
  }>;
};

export default async function AdminCompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const companies = await getAdminCompanies({
    q: params.q,
    status: params.status,
    membershipStatus: params.membershipStatus,
  });

  return (
    <AdminCompaniesContent
      companies={companies}
      filters={{
        q: params.q,
        status: params.status,
        membershipStatus: params.membershipStatus,
      }}
    />
  );
}
