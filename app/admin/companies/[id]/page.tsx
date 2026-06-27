import { notFound } from "next/navigation";
import { AdminCompanyDetailShell } from "@/components/admin/companies/admin-company-detail-shell";
import type { AdminCompanyTab } from "@/lib/admin/companies/admin-company-detail-service";
import {
  getAdminCompanyActivityTab,
  getAdminCompanyHeader,
  getAdminCompanyIntegrationsTab,
  getAdminCompanyOverviewTab,
  getAdminCompanyPaymentsTab,
  getAdminCompanySubscriptionTab,
  getAdminCompanyUsageTab,
  getAdminCompanyUsersTab,
} from "@/lib/admin/companies/admin-company-detail-service";
import { listAdminCompanyNotes } from "@/lib/admin/companies/admin-company-note-service";

const TABS: AdminCompanyTab[] = [
  "overview",
  "users",
  "subscription",
  "payments",
  "usage",
  "integrations",
  "activity",
  "notes",
];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCompanyDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const tab = (typeof query.tab === "string" ? query.tab : "overview") as AdminCompanyTab;

  const header = await getAdminCompanyHeader(id);
  if (!header) notFound();

  const safeTab = TABS.includes(tab) ? tab : "overview";

  let tabData: unknown = null;
  try {
    if (safeTab === "overview") tabData = await getAdminCompanyOverviewTab(id);
    else if (safeTab === "users") tabData = await getAdminCompanyUsersTab(id);
    else if (safeTab === "subscription")
      tabData = await getAdminCompanySubscriptionTab(id);
    else if (safeTab === "payments")
      tabData = await getAdminCompanyPaymentsTab(
        id,
        Number(typeof query.page === "string" ? query.page : 1)
      );
    else if (safeTab === "usage") tabData = await getAdminCompanyUsageTab(id);
    else if (safeTab === "integrations")
      tabData = await getAdminCompanyIntegrationsTab(id);
    else if (safeTab === "activity")
      tabData = await getAdminCompanyActivityTab(id, {
        page: Number(typeof query.page === "string" ? query.page : 1),
        module: typeof query.module === "string" ? query.module : undefined,
        action: typeof query.action === "string" ? query.action : undefined,
        q: typeof query.q === "string" ? query.q : undefined,
      });
    else if (safeTab === "notes") tabData = await listAdminCompanyNotes(id);
  } catch (error) {
    console.error(`ADMIN_COMPANY_TAB_${safeTab}_ERROR`, error);
    tabData = { error: "Bu sekme verisi şu anda yüklenemedi." };
  }

  return (
    <AdminCompanyDetailShell header={header} tab={safeTab} tabData={tabData} />
  );
}
