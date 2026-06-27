import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminPartnerDetailTabs } from "@/components/admin/admin-partner-detail-tabs";
import {
  getPartnerDetail,
  listPartnerActivity,
  listPartnerCommissions,
  listPartnerCompanies,
  listPartnerHistory,
} from "@/lib/admin/partners";
import { listAdminPartnerNotes } from "@/lib/admin/partners/admin-partner-note-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPartnerDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  let detail;
  try {
    detail = await getPartnerDetail(id);
  } catch {
    notFound();
  }

  const coPage = Math.max(1, Number(sp.coPage ?? 1) || 1);
  const historyPage = Math.max(1, Number(sp.historyPage ?? 1) || 1);
  const activityPage = Math.max(1, Number(sp.activityPage ?? 1) || 1);

  const [companies, commissions, history, activity, notes] = await Promise.all([
    tab === "companies" || tab === "overview"
      ? listPartnerCompanies(id, { page: coPage, pageSize: 25 })
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "commissions" ? listPartnerCommissions(id, { page: 1, pageSize: 25 }) : Promise.resolve(null),
    tab === "history" || tab === "overview"
      ? listPartnerHistory(id, historyPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "activity"
      ? listPartnerActivity(id, activityPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "notes" ? listAdminPartnerNotes(id) : Promise.resolve([]),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminPartnerDetailTabs
        detail={detail}
        companies={companies.items}
        companiesPagination={companies.pagination}
        commissions={commissions}
        history={history.items}
        historyPagination={history.pagination}
        activity={activity.items}
        activityPagination={activity.pagination}
        notes={notes}
      />
    </AdminPageContainer>
  );
}
