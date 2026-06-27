import { AdminCampaignCreateForm } from "@/components/admin/admin-campaign-create-form";
import { db } from "@/lib/prisma";

export default async function AdminCampaignNewPage() {
  const plans = await db.membershipPlan.findMany({
    where: { planStatus: { in: ["ACTIVE", "DRAFT"] } },
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  return <AdminCampaignCreateForm plans={plans} />;
}
