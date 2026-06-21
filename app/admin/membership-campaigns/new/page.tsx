import { AdminCampaignCreateForm } from "@/components/admin/admin-campaign-create-form";
import { db } from "@/lib/prisma";

export default async function AdminMembershipCampaignNewPage() {
  const plans = await db.membershipPlan.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  return <AdminCampaignCreateForm plans={plans} />;
}
