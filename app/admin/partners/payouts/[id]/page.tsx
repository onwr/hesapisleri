import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPartnerPayoutDetailTabs } from "@/components/admin/admin-partner-payout-detail-tabs";
import {
  AdminPartnerPayoutServiceError,
  getPartnerPayoutDetail,
  listPayoutActivity,
  listPayoutEarnings,
  listPayoutHistory,
} from "@/lib/admin/partner-payouts";
import { listAdminPartnerPayoutNotes } from "@/lib/admin/partner-payouts/admin-partner-payout-note-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPartnerPayoutDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  let detail;
  try {
    detail = await getPartnerPayoutDetail(id);
  } catch (error) {
    if (error instanceof AdminPartnerPayoutServiceError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const historyPage = Math.max(1, Number(sp.historyPage ?? 1) || 1);
  const activityPage = Math.max(1, Number(sp.activityPage ?? 1) || 1);

  const [earnings, history, activity, notes] = await Promise.all([
    tab === "earnings" || tab === "overview" ? listPayoutEarnings(id) : Promise.resolve([]),
    tab === "history" || tab === "overview"
      ? listPayoutHistory(id, historyPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "activity"
      ? listPayoutActivity(id, activityPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "notes" ? listAdminPartnerPayoutNotes(id) : Promise.resolve([]),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminPartnerPayoutDetailTabs
        detail={detail}
        earnings={earnings}
        history={history.items}
        activity={activity.items}
        notes={notes}
      />
    </AdminPageContainer>
  );
}
