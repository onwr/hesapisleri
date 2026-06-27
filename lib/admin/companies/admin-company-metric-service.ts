import { unstable_cache } from "next/cache";
import { db } from "@/lib/prisma";

export type AdminCompanyListMetrics = {
  total: number;
  active: number;
  trial: number;
  paid: number;
  pastDue: number;
  suspended: number;
  newLast30Days: number;
  inactiveLast30Days: number;
};

async function loadAdminCompanyListMetrics(): Promise<AdminCompanyListMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    total,
    active,
    trial,
    paid,
    pastDue,
    suspended,
    newLast30Days,
    inactiveLast30Days,
  ] = await Promise.all([
    db.company.count({ where: { archivedAt: null } }),
    db.company.count({ where: { status: "ACTIVE", archivedAt: null } }),
    db.companySubscription.count({ where: { status: "TRIAL" } }),
    db.companySubscription.count({
      where: { status: { in: ["ACTIVE", "CANCEL_AT_PERIOD_END"] } },
    }),
    db.companySubscription.count({
      where: { status: { in: ["PAST_DUE", "GRACE_PERIOD"] } },
    }),
    db.company.count({ where: { status: "SUSPENDED" } }),
    db.company.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.company.count({
      where: {
        status: "ACTIVE",
        archivedAt: null,
        activityLogs: { none: { createdAt: { gte: thirtyDaysAgo } } },
      },
    }),
  ]);

  return {
    total,
    active,
    trial,
    paid,
    pastDue,
    suspended,
    newLast30Days,
    inactiveLast30Days,
  };
}

export async function getAdminCompanyListMetrics() {
  return unstable_cache(
    loadAdminCompanyListMetrics,
    ["admin-company-list-metrics"],
    { revalidate: 45 }
  )();
}
