import { AdminMembershipPlansList } from "@/components/admin/admin-membership-plans-list";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPageHeader } from "@/components/admin/layout/admin-page-header";
import { listMembershipPlans } from "@/lib/membership-service";

export default async function AdminMembershipPlansPage() {
  const plans = await listMembershipPlans();

  return (
    <AdminPageContainer size="full">
      <AdminPageHeader
        title="Üyelik Planları"
        description="Planları ve dönem fiyatlarını yönetin. Detaylı düzenleme için plan satırından devam edin."
      />
      <AdminMembershipPlansList plans={plans} />
    </AdminPageContainer>
  );
}
