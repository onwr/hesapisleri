import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminCampaignDetailTabs } from "@/components/admin/admin-campaign-detail-tabs";
import {
  getCampaignAnalytics,
  getCampaignDetail,
  listCampaignActivity,
  listCampaignAffectedSubscriptions,
  listCampaignHistory,
  listCampaignUsage,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCampaignDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  const data = await getCampaignDetail(id);
  if (!data) notFound();

  const usagePage = Math.max(1, Number(sp.usagePage ?? 1) || 1);
  const activityPage = Math.max(1, Number(sp.activityPage ?? 1) || 1);
  const historyPage = Math.max(1, Number(sp.historyPage ?? 1) || 1);

  const [analytics, affected, history, activity, usage, companies] = await Promise.all([
    getCampaignAnalytics(id),
    tab === "overview" ? listCampaignAffectedSubscriptions(id) : Promise.resolve([]),
    tab === "history" || tab === "overview"
      ? listCampaignHistory(id, historyPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "activity"
      ? listCampaignActivity(id, activityPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "usage"
      ? listCampaignUsage(id, { page: usagePage, pageSize: 25 })
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 }, totals: { successfulUsage: data.stats.usageCount } }),
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
        history={history.items}
        historyPagination={history.pagination}
        activity={activity.items}
        activityPagination={activity.pagination}
        usage={usage.items}
        usagePagination={usage.pagination}
        usageTotals={usage.totals}
        companies={companies}
        plans={await db.membershipPlan.findMany({
          where: { planStatus: { in: ["ACTIVE", "DRAFT"] } },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        })}
      />
    </AdminPageContainer>
  );
}
