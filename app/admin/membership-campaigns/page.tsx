import { AdminMembershipCampaignsContent } from "@/components/admin/admin-membership-campaigns-content";
import {
  countActiveCampaignFilters,
  getCampaignSummary,
  listCampaigns,
  parseCampaignListFilters,
} from "@/lib/admin/promotions";
import { db } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMembershipCampaignsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseCampaignListFilters(params);
  const activeFilterCount = countActiveCampaignFilters(filters);

  const [list, summary, plans] = await Promise.all([
    listCampaigns(filters),
    getCampaignSummary(),
    db.membershipPlan.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <AdminMembershipCampaignsContent
      list={list}
      summary={summary}
      filters={filters}
      plans={plans}
      activeFilterCount={activeFilterCount}
    />
  );
}
