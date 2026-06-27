import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminAddonDetailTabs } from "@/components/admin/admin-addon-detail-tabs";
import {
  getAddOnDetail,
  listAddOnActivity,
  listAddOnHistory,
  listAddOnSubscriptions,
} from "@/lib/admin/addons";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAddOnDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  const detail = await getAddOnDetail(id);
  if (!detail) notFound();

  const subsPage = Math.max(1, Number(sp.subsPage ?? 1) || 1);
  const historyPage = Math.max(1, Number(sp.historyPage ?? 1) || 1);
  const activityPage = Math.max(1, Number(sp.activityPage ?? 1) || 1);

  const [history, activity, subscriptions] = await Promise.all([
    tab === "history" || tab === "overview"
      ? listAddOnHistory(id, historyPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "activity"
      ? listAddOnActivity(id, activityPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "subscriptions"
      ? listAddOnSubscriptions(id, { page: subsPage, pageSize: 25 })
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminAddonDetailTabs
        detail={detail}
        history={history.items}
        historyPagination={history.pagination}
        activity={activity.items}
        activityPagination={activity.pagination}
        subscriptions={subscriptions.items}
        subscriptionsPagination={subscriptions.pagination}
      />
    </AdminPageContainer>
  );
}
