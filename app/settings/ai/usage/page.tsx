import { AppShell } from "@/components/layout/app-shell";
import { AiAdminUsagePanel } from "@/components/settings/ai-admin-usage-panel";
import { guardPageModule } from "@/lib/module-access";
import { canViewAiUsageStats } from "@/lib/ai/ai-permission-service";
import { redirect } from "next/navigation";

export default async function AiUsageAdminPage() {
  const session = await guardPageModule("settings");
  const canView = canViewAiUsageStats(
    session.effectiveRole,
    session.companyUser.isOwner
  );
  if (!canView) redirect("/unauthorized");

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <AiAdminUsagePanel />
      </div>
    </AppShell>
  );
}
