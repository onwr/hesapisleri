import { AdminPlansListActions, AdminPlansListShell } from "@/components/admin/plans/admin-plans-list-shell";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { adminPlanListQuerySchema } from "@/lib/admin/plans/admin-plan-schemas";
import { getAdminPlanList } from "@/lib/admin/plans/admin-plan-list-service";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPlansPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flatParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])
  );
  const query = adminPlanListQuerySchema.parse(flatParams);
  const list = await getAdminPlanList(query);

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Üyelik Planları"
        description="Planları, fiyatları ve abonelik etkisini yönetin."
        primaryAction={<AdminPlansListActions />}
      />
      <AdminPlansListShell list={list} query={query} />
    </AdminPageContainer>
  );
}
