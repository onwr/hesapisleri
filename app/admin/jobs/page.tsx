import { listAdminJobs, parseJobListFilters } from "@/lib/admin/jobs";
import { AdminJobsContent } from "@/components/admin/jobs/admin-jobs-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminJobsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseJobListFilters(params);
  const data = await listAdminJobs(filters);

  return <AdminJobsContent data={data} filters={filters} />;
}
