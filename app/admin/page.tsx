import { AdminOverviewContent } from "@/components/admin/overview/admin-overview-content";
import { getAdminOverview } from "@/lib/admin-service";

type AdminPageProps = {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    timezone?: string;
  }>;
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminPageProps) {
  const params = await searchParams;
  const data = await getAdminOverview({
    range: params.range,
    from: params.from,
    to: params.to,
    timezone: params.timezone,
  });

  return <AdminOverviewContent data={data} />;
}
