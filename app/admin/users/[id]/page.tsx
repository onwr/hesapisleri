import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminUserDetailShell } from "@/components/admin/users/admin-user-detail-shell";
import { getSuperAdminSession } from "@/lib/admin-auth";
import {
  getAdminUserHeader,
  getAdminUserOverviewTab,
  getAdminUserCompaniesTab,
  getAdminUserSecurityTab,
  getAdminUserActivityTab,
  getAdminUserSupportTab,
  type AdminUserTab,
} from "@/lib/admin/users/admin-user-detail-service";
import { listAdminUserNotes } from "@/lib/admin/users/admin-user-note-service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
};

const VALID_TABS: AdminUserTab[] = [
  "overview",
  "companies",
  "security",
  "activity",
  "support",
  "notes",
];

function resolveTab(raw: string | undefined): AdminUserTab {
  if (raw && (VALID_TABS as string[]).includes(raw)) {
    return raw as AdminUserTab;
  }
  return "overview";
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ user }, { id }, sp] = await Promise.all([
    getSuperAdminSession(),
    params,
    searchParams,
  ]);

  const header = await getAdminUserHeader(id);
  if (!header) notFound();

  const tab = resolveTab(sp.tab);
  const activityPage = Math.max(1, parseInt(sp.page ?? "1") || 1);

  let tabData: unknown = null;
  try {
    if (tab === "overview") tabData = await getAdminUserOverviewTab(id);
    else if (tab === "companies") tabData = await getAdminUserCompaniesTab(id);
    else if (tab === "security") tabData = await getAdminUserSecurityTab(id);
    else if (tab === "activity")
      tabData = await getAdminUserActivityTab(id, { page: activityPage });
    else if (tab === "support") tabData = await getAdminUserSupportTab(id);
    else if (tab === "notes") {
      const notes = await listAdminUserNotes(id);
      tabData = notes;
    }
  } catch {
    tabData = { error: "Bu sekme verileri yüklenemedi." };
  }

  return (
    <Suspense>
      <AdminUserDetailShell
        header={header}
        tab={tab}
        tabData={tabData}
        currentUserId={user.id}
      />
    </Suspense>
  );
}
