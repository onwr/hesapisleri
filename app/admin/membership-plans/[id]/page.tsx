import { notFound } from "next/navigation";
import { AdminMembershipPlansPanel } from "@/components/admin/admin-membership-plans-panel";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { listMembershipPlans } from "@/lib/membership-service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMembershipPlanDetailPage({
  params,
}: PageProps) {
  const { id } = await params;
  const plans = await listMembershipPlans();
  const plan = plans.find((item) => item.id === id);

  if (!plan) notFound();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title={plan.name}
        description="Plan meta bilgileri ve versiyonlu dönem fiyatlarını yönetin."
        backHref="/admin/membership-plans"
      />
      <AdminMembershipPlansPanel initialPlans={[plan]} />
    </AdminPageContainer>
  );
}
