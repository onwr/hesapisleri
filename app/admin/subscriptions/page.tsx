import { AdminSubscriptionsListShell } from "@/components/admin/subscriptions/admin-subscriptions-list-shell";
import { getAdminSubscriptionList } from "@/lib/admin/subscriptions/admin-subscription-list-service";
import { getAdminSubscriptionMetrics } from "@/lib/admin/subscriptions/admin-subscription-metric-service";
import { adminSubListQuerySchema } from "@/lib/admin/subscriptions/admin-subscription-schemas";
import { db } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const flatParams = Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v ?? ""])
  );

  const query = adminSubListQuerySchema.parse(flatParams);

  const [list, metrics, plans] = await Promise.all([
    getAdminSubscriptionList(query),
    getAdminSubscriptionMetrics(),
    db.membershipPlan.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AdminSubscriptionsListShell
      list={list}
      metrics={metrics}
      query={query}
      plans={plans}
    />
  );
}
