import { notFound } from "next/navigation";
import { AdminPageContainer } from "@/components/admin/layout/admin-page-container";
import { AdminCouponDetailTabs } from "@/components/admin/admin-coupon-detail-tabs";
import {
  getCouponAnalytics,
  getCouponDetail,
  listCouponActivityHistory,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminMembershipCouponDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getCouponDetail(id);
  if (!data) notFound();

  const [analytics, history, companies] = await Promise.all([
    getCouponAnalytics(id),
    listCouponActivityHistory(id),
    db.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 50,
    }),
  ]);

  return (
    <AdminPageContainer size="full">
      <AdminCouponDetailTabs
        detail={data}
        analytics={analytics}
        history={history}
        companies={companies}
      />
    </AdminPageContainer>
  );
}
