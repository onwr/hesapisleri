import { AdminCouponCreateForm } from "@/components/admin/admin-coupon-create-form";
import { db } from "@/lib/prisma";

export default async function AdminMembershipCouponNewPage() {
  const [plans, companies] = await Promise.all([
    db.membershipPlan.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.company.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 30,
    }),
  ]);

  return <AdminCouponCreateForm plans={plans} companies={companies} />;
}
