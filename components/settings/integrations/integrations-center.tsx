"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { IntegrationSummary } from "@/lib/marketplace/marketplace-integration-service";
import { MarketplaceIntegrationCard } from "@/components/settings/integrations/marketplace-integration-card";
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
  initialRuns: SyncRunRow[];
  warehouses: Array<{ id: string; name: string }>;
};

export function IntegrationsCenter({
  initialTrendyol,
  initialHepsiburada,
  initialRuns,
  warehouses,
}: IntegrationsCenterProps) {
  const router = useRouter();
  const [trendyol, setTrendyol] = useState(initialTrendyol);
  const [hepsiburada, setHepsiburada] = useState(initialHepsiburada);
  const [runs, setRuns] = useState(initialRuns);

  async function refetch() {
    const [integrationRes, runsRes] = await Promise.all([
      fetch("/api/integrations", { cache: "no-store" }),
      fetch("/api/integrations/sync-runs?limit=20", { cache: "no-store" }),
    ]);
    const integrationData = await integrationRes.json();
    const runsData = await runsRes.json();
    if (integrationRes.ok && integrationData.success) {
      const rows = integrationData.data as IntegrationSummary[];
      setTrendyol(rows.find((item) => item.channel === "TRENDYOL") ?? null);
      setHepsiburada(
        rows.find((item) => item.channel === "HEPSIBURADA") ?? null
      );
    }
    if (runsRes.ok && runsData.success) {
      setRuns(runsData.data as SyncRunRow[]);
    }
    router.refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <MarketplaceIntegrationCard
            channel="TRENDYOL"
            integration={trendyol}
            warehouses={warehouses}
            onRefetch={refetch}
          />
          <MarketplaceIntegrationCard
            channel="HEPSIBURADA"
            integration={hepsiburada}
            warehouses={warehouses}
            onRefetch={refetch}
          />
        </div>
        <IntegrationSkuMappingGuide variant="page" />
        <MarketplaceSyncRunsTable runs={runs} onRefresh={refetch} />
      </div>
      <IntegrationHelpPanel />
    </div>
  );
}
