import { AdminDashboardContent } from "@/components/admin/admin-dashboard-content";
import { getAdminOverview } from "@/lib/admin-service";

export default async function AdminDashboardPage() {
  const data = await getAdminOverview();

  return <AdminDashboardContent data={data} />;
}
