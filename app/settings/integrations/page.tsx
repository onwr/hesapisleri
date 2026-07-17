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
import { getEDocumentIntegrationSummary } from "@/lib/e-document/e-document-integration-service";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import { db } from "@/lib/prisma";
import { isIntegrationEncryptionConfigured } from "@/lib/marketplace/marketplace-crypto";

export default async function SettingsIntegrationsPage() {
  const session = await getAppSession();
  if (!canManageSettings(session.effectiveRole, session.companyUser.isOwner)) {
    redirect("/unauthorized");
  }

  const marketplaceFeatureEnabled = isMarketplaceFeatureEnabled();

  const [trendyol, hepsiburada, eDocument, runs, warehouses] = await Promise.all([
    marketplaceFeatureEnabled
      ? getMarketplaceIntegration(session.company.id, "TRENDYOL")
      : Promise.resolve(null),
    marketplaceFeatureEnabled
      ? getMarketplaceIntegration(session.company.id, "HEPSIBURADA")
      : Promise.resolve(null),
    getEDocumentIntegrationSummary(session.company.id),
    marketplaceFeatureEnabled
      ? listMarketplaceSyncRuns({
          companyId: session.company.id,
          limit: 20,
        })
      : Promise.resolve([]),
    marketplaceFeatureEnabled
      ? db.warehouse.findMany({
          where: { companyId: session.company.id, status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const connectedCount = marketplaceFeatureEnabled
    ? [trendyol, hepsiburada].filter((item) => item?.status === "CONNECTED")
        .length +
      (eDocument.status === "CONNECTED" && eDocument.providerConnectionReady
        ? 1
        : 0)
    : eDocument.status === "CONNECTED" && eDocument.providerConnectionReady
      ? 1
      : 0;
  const errorCount = runs.filter(
    (run: { status: string }) =>
      run.status === "FAILED" || run.status === "PARTIAL_SUCCESS"
  ).length;
  const lastSyncAt = runs[0]?.startedAt ?? null;
  const autoSyncEnabled = [trendyol, hepsiburada].some(
    (item) => item?.syncEnabled
  );
  const encryptionConfigured = isIntegrationEncryptionConfigured();

  return (
    <AppShell>
      <div className="space-y-5">
        {marketplaceFeatureEnabled && !encryptionConfigured ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Pazaryeri bağlantı bilgilerini kaydetmek için sunucuda{" "}
            <code className="font-mono text-xs">INTEGRATION_ENCRYPTION_KEY</code>{" "}
            (32 byte) tanımlanmalıdır. Sayfayı görüntüleyebilirsiniz; kayıt ve
            test bağlantısı bu anahtar olmadan çalışmaz.
          </div>
        ) : null}

        <IntegrationsHero
          connectedCount={connectedCount}
          errorCount={errorCount}
          lastSyncAt={lastSyncAt}
          autoSyncEnabled={autoSyncEnabled}
          marketplaceFeatureEnabled={marketplaceFeatureEnabled}
        />

        <IntegrationsCenter
          initialTrendyol={trendyol}
          initialHepsiburada={hepsiburada}
          initialEDocument={eDocument}
          initialRuns={runs}
          warehouses={warehouses}
          encryptionConfigured={encryptionConfigured}
          marketplaceFeatureEnabled={marketplaceFeatureEnabled}
        />
      </div>
    </AppShell>
  );
}
