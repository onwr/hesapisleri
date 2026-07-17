"use client";

import { useState } from "react";
import { notifyTenantCacheSync } from "@/lib/tenant-cache/client-tenant-sync";
import type { IntegrationSummary } from "@/lib/marketplace/marketplace-integration-service";
import type { EDocumentIntegrationSummary } from "@/lib/e-document/e-document-integration-service";
import { MarketplaceIntegrationCard } from "@/components/settings/integrations/marketplace-integration-card";
import { EDocumentIntegrationCard } from "@/components/settings/integrations/e-document-integration-card";
import { MarketplaceSyncRunsTable } from "@/components/settings/integrations/marketplace-sync-runs-table";
import { IntegrationHelpPanel } from "@/components/settings/integrations/integration-help-panel";
import { IntegrationSkuMappingGuide } from "@/components/settings/integrations/integration-sku-mapping-guide";

type SyncRunRow = {
  id: string;
  channel: string;
  type: string;
  status: string;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errors: unknown;
  startedAt: string;
  finishedAt: string | null;
};

type IntegrationsCenterProps = {
  initialTrendyol: IntegrationSummary | null;
  initialHepsiburada: IntegrationSummary | null;
  initialEDocument: EDocumentIntegrationSummary;
  initialRuns: SyncRunRow[];
  warehouses: Array<{ id: string; name: string }>;
  encryptionConfigured?: boolean;
  marketplaceFeatureEnabled?: boolean;
};

export function IntegrationsCenter({
  initialTrendyol,
  initialHepsiburada,
  initialEDocument,
  initialRuns,
  warehouses,
  encryptionConfigured = true,
  marketplaceFeatureEnabled = false,
}: IntegrationsCenterProps) {
  const [trendyol, setTrendyol] = useState(initialTrendyol);
  const [hepsiburada, setHepsiburada] = useState(initialHepsiburada);
  const [eDocument, setEDocument] = useState(initialEDocument);
  const [runs, setRuns] = useState(initialRuns);

  async function refetch() {
    const requests: Array<Promise<Response>> = [
      fetch("/api/integrations/e-document", { cache: "no-store" }),
    ];
    if (marketplaceFeatureEnabled) {
      requests.unshift(
        fetch("/api/integrations", { cache: "no-store" }),
        fetch("/api/integrations/sync-runs?limit=20", { cache: "no-store" })
      );
    }
    const responses = await Promise.all(requests);
    if (marketplaceFeatureEnabled) {
      const [integrationRes, runsRes, eDocumentRes] = responses;
      const integrationData = await integrationRes.json();
      const eDocumentData = await eDocumentRes.json();
      const runsData = await runsRes.json();
      if (integrationRes.ok && integrationData.success) {
        const rows = integrationData.data as IntegrationSummary[];
        setTrendyol(rows.find((item) => item.channel === "TRENDYOL") ?? null);
        setHepsiburada(
          rows.find((item) => item.channel === "HEPSIBURADA") ?? null
        );
      }
      if (eDocumentRes.ok && eDocumentData.success) {
        setEDocument(eDocumentData.data as EDocumentIntegrationSummary);
      }
      if (runsRes.ok && runsData.success) {
        setRuns(runsData.data as SyncRunRow[]);
      }
    } else {
      const [eDocumentRes] = responses;
      const eDocumentData = await eDocumentRes.json();
      if (eDocumentRes.ok && eDocumentData.success) {
        setEDocument(eDocumentData.data as EDocumentIntegrationSummary);
      }
    }
    notifyTenantCacheSync();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          {marketplaceFeatureEnabled ? (
            <>
              <MarketplaceIntegrationCard
                channel="TRENDYOL"
                integration={trendyol}
                warehouses={warehouses}
                onRefetch={refetch}
                encryptionConfigured={encryptionConfigured}
              />
              <MarketplaceIntegrationCard
                channel="HEPSIBURADA"
                integration={hepsiburada}
                warehouses={warehouses}
                onRefetch={refetch}
                encryptionConfigured={encryptionConfigured}
              />
            </>
          ) : null}
          <EDocumentIntegrationCard integration={eDocument} onRefetch={refetch} />
        </div>
        {marketplaceFeatureEnabled ? (
          <>
            <IntegrationSkuMappingGuide variant="page" />
            <MarketplaceSyncRunsTable runs={runs} onRefresh={refetch} />
          </>
        ) : null}
      </div>
      {marketplaceFeatureEnabled ? <IntegrationHelpPanel /> : null}
    </div>
  );
}
