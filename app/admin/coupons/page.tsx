import { AdminMembershipCouponsContent } from "@/components/admin/admin-membership-coupons-content";
import {
  countActiveCouponFilters,
  getCouponSummary,
  listCoupons,
  parseCouponListFilters,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCouponsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseCouponListFilters(params);
  const activeFilterCount = countActiveCouponFilters(filters);

  const [list, summary, plans] = await Promise.all([
    listCoupons(filters),
    getCouponSummary(),
    db.membershipPlan.findMany({
      where: { planStatus: { in: ["ACTIVE", "DRAFT"] } },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <AdminMembershipCouponsContent
      list={list}
      summary={summary}
      filters={filters}
      plans={plans}
      activeFilterCount={activeFilterCount}
    />
  );
}
