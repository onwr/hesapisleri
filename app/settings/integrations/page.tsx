import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { IntegrationsCenter } from "@/components/settings/integrations/integrations-center";
import { IntegrationsHero } from "@/components/settings/integrations/integrations-hero";
import { getAppSession } from "@/lib/app-session";
import { canManageSettings } from "@/lib/permission-utils";
import {
  getMarketplaceIntegration,
  listMarketplaceSyncRuns,
} from "@/lib/marketplace/marketplace-integration-service";
import { db } from "@/lib/prisma";

export default async function SettingsIntegrationsPage() {
  const session = await getAppSession();
  if (!canManageSettings(session.effectiveRole, session.companyUser.isOwner)) {
    redirect("/unauthorized");
  }

  const [trendyol, hepsiburada, runs, warehouses] = await Promise.all([
    getMarketplaceIntegration(session.company.id, "TRENDYOL"),
    getMarketplaceIntegration(session.company.id, "HEPSIBURADA"),
    listMarketplaceSyncRuns({
      companyId: session.company.id,
      limit: 20,
    }),
    db.warehouse.findMany({
      where: { companyId: session.company.id, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
  ]);

  const connectedCount = [trendyol, hepsiburada].filter(
    (item) => item?.status === "CONNECTED"
  ).length;
  const errorCount = runs.filter(
    (run: { status: string }) =>
      run.status === "FAILED" || run.status === "PARTIAL_SUCCESS"
  ).length;
  const lastSyncAt = runs[0]?.startedAt ?? null;
  const autoSyncEnabled = [trendyol, hepsiburada].some(
    (item) => item?.syncEnabled
  );

  return (
    <AppShell>
      <div className="space-y-5">
        <IntegrationsHero
          connectedCount={connectedCount}
          errorCount={errorCount}
          lastSyncAt={lastSyncAt}
          autoSyncEnabled={autoSyncEnabled}
        />

        <IntegrationsCenter
          initialTrendyol={trendyol}
          initialHepsiburada={hepsiburada}
          initialRuns={runs}
          warehouses={warehouses}
        />
      </div>
    </AppShell>
  );
}
