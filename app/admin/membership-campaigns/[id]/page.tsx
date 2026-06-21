import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminCampaignDetailTabs } from "@/components/admin/admin-campaign-detail-tabs";
import {
  getCampaignAnalytics,
  getCampaignDetail,
  listCampaignActivityHistory,
  listCampaignAffectedSubscriptions,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminMembershipCampaignDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getCampaignDetail(id);
  if (!data) notFound();

  const [analytics, affected, history, companies] = await Promise.all([
    getCampaignAnalytics(id),
    listCampaignAffectedSubscriptions(id),
    listCampaignActivityHistory(id),
    db.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminCampaignDetailTabs
        detail={data}
        analytics={analytics}
        affected={affected}
        history={history}
        companies={companies}
      />
    </AdminPageContainer>
  );
}
