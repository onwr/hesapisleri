import Link from "next/link";
import { AdminPlansListShell } from "@/components/admin/plans/admin-plans-list-shell";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { appPrimaryButtonClass } from "@/lib/admin-ui";
import { adminPlanListQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanList } from "@/lib/admin/plans/admin-plan-list-service";
import { getAdminPlanMetrics } from "@/lib/admin/plans/admin-plan-metric-service";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPlansPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flatParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])
  );
  const query = adminPlanListQuerySchema.parse(flatParams);

  const [list, metrics] = await Promise.all([
    getAdminPlanList(query),
    getAdminPlanMetrics(),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Üyelik Planları"
        description="Plan lifecycle, fiyat versiyonları ve checkout görünürlüğü. Çoklu plan checkout ayrı fazda."
        primaryAction={
          <Link href="/admin/plans/new" className={appPrimaryButtonClass}>
            Yeni Plan
          </Link>
        }
      />
      <AdminPlansListShell list={list} metrics={metrics} query={query} />
    </AdminPageContainer>
  );
}
