import { notFound } from "next/navigation";
import { AdminPlanDetailShell } from "@/components/admin/plans/admin-plan-detail-shell";
import { getAdminPlanDetail } from "@/lib/admin/plans/admin-plan-detail-service";
import { resolvePlanTab } from "@/lib/admin/plans/admin-plan-schemas";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPlanDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = resolvePlanTab(tabRaw);

  const detail = await getAdminPlanDetail(id, tab, sp);
  if (!detail) notFound();

  return (
    <AdminPlanDetailShell
      planId={id}
      header={detail.header}
      activeTab={tab}
      initialTabData={detail.tabData}
      planBasics={detail.plan}
    />
  );
}
