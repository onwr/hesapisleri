import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminCouponDetailTabs } from "@/components/admin/admin-coupon-detail-tabs";
import {
  getCouponAnalytics,
  getCouponDetail,
  listCouponActivity,
  listCouponHistory,
  listCouponUsage,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCouponDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : "overview";

  const data = await getCouponDetail(id);
  if (!data) notFound();

  const usagePage = Math.max(1, Number(sp.usagePage ?? 1) || 1);
  const activityPage = Math.max(1, Number(sp.activityPage ?? 1) || 1);
  const historyPage = Math.max(1, Number(sp.historyPage ?? 1) || 1);

  const [analytics, history, activity, usage, companies, plans] = await Promise.all([
    getCouponAnalytics(id),
    tab === "history" || tab === "overview"
      ? listCouponHistory(id, historyPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "activity"
      ? listCouponActivity(id, activityPage, 25)
      : Promise.resolve({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } }),
    tab === "usage"
      ? listCouponUsage(id, { page: usagePage, pageSize: 25 })
      : Promise.resolve({
          items: [],
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
          totals: { successfulUsage: data.stats.usageCount },
        }),
    db.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
    db.membershipPlan.findMany({
      where: { planStatus: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminCouponDetailTabs
        detail={data}
        analytics={analytics}
        history={history.items}
        historyPagination={history.pagination}
        activity={activity.items}
        activityPagination={activity.pagination}
        usage={usage.items}
        usagePagination={usage.pagination}
        usageTotals={usage.totals}
        companies={companies}
        plans={plans}
      />
    </AdminPageContainer>
  );
}
