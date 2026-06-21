import { AdminSubscriptionsContent } from "@/components/admin/admin-subscriptions-content";
import {
  getAdminSubscriptionsSummary,
  listAdminSubscriptionPartners,
  listAdminSubscriptionPlans,
  listAdminSubscriptions,
} from "@/lib/admin-subscription-service";
import { parseAdminSubscriptionFilters } from "@/lib/admin-subscription-utils";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSubscriptionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseAdminSubscriptionFilters(params);

  const [list, summary, plans, partners] = await Promise.all([
    listAdminSubscriptions(filters),
    getAdminSubscriptionsSummary(),
    listAdminSubscriptionPlans(),
    listAdminSubscriptionPartners(),
  ]);

  return (
    <AdminSubscriptionsContent
      list={list}
      summary={summary}
      filters={filters}
      plans={plans}
      partners={partners}
    />
  );
}
