import "server-only";

import { syncMarketplaceIntegration } from "@/lib/marketplace/marketplace-sync-service";
import { db } from "@/lib/prisma";

export async function runMarketplaceSyncCron() {
  const integrations = await db.marketplaceIntegration.findMany({
    where: {
      status: "CONNECTED",
      syncEnabled: true,
      credentialsEncrypted: { not: null },
    },
    select: {
      companyId: true,
      channel: true,
    },
  });

  const summary = {
    total: integrations.length,
    success: 0,
    failed: 0,
    items: [] as Array<{
      companyId: string;
      channel: string;
      ok: boolean;
      message?: string;
    }>,
  };

  for (const integration of integrations) {
    try {
      await syncMarketplaceIntegration({
        companyId: integration.companyId,
        channel: integration.channel,
        type: "AUTO",
      });
      summary.success += 1;
      summary.items.push({
        companyId: integration.companyId,
        channel: integration.channel,
        ok: true,
      });
    } catch (error) {
      summary.failed += 1;
      summary.items.push({
        companyId: integration.companyId,
        channel: integration.channel,
        ok: false,
        message: error instanceof Error ? error.message : "Sync başarısız.",
      });
    }
  }

  return summary;
}
