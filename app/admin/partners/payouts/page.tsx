import {
  getPartnerPayoutSummary,
  listPartnerPayoutsAdmin,
  parsePayoutListFilters,
} from "@/lib/admin/partner-payouts";
import { getAdminPartnerSettings } from "@/lib/admin/partner-settings";
import { listPartners } from "@/lib/admin/partners";
import { AdminPartnerPayoutsContent } from "@/components/admin/admin-partner-payouts-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPartnerPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parsePayoutListFilters(params);

  const [summary, list, partnersData, settingsData] = await Promise.all([
    getPartnerPayoutSummary(),
    listPartnerPayoutsAdmin(filters),
    listPartners({ page: 1, pageSize: 100, sort: "name_asc" }),
    getAdminPartnerSettings(),
  ]);

  const partners = partnersData.items
    .filter((p) => p.status !== "ARCHIVED")
    .map((p) => ({
      id: p.id,
      fullName: p.fullName,
      referralCode: p.referralCode,
      status: p.status,
    }));

  return (
    <AdminPartnerPayoutsContent
      summary={summary}
      list={list}
      filters={filters}
      partners={partners}
      minimumPayoutAmount={settingsData.settings.minimumPayoutAmount}
    />
  );
}
