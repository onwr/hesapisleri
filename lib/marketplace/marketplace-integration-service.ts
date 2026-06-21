import type {
  MarketplaceChannel,
  MarketplaceIntegration,
  MarketplaceIntegrationStatus,
} from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  assertIntegrationEncryptionConfigured,
  decryptMarketplaceCredentials,
  encryptMarketplaceCredentials,
} from "@/lib/marketplace/marketplace-crypto";
import {
  HepsiburadaAdapter,
  type HepsiburadaCredentials,
} from "@/lib/marketplace/adapters/hepsiburada-adapter";
import type { MarketplaceAdapter } from "@/lib/marketplace/marketplace-types";
import {
  TrendyolAdapter,
  type TrendyolCredentials,
} from "@/lib/marketplace/adapters/trendyol-adapter";
import {
  resolveTrendyolCredentials,
  storedCredentialTestFailureMessage,
  trendyolRequiresFreshSecrets,
} from "@/lib/marketplace/trendyol-integration-utils";

export type TrendyolIntegrationInput = {
  supplierId?: string;
  apiKey?: string;
  apiSecret?: string;
  syncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
  defaultWarehouseId?: string | null;
};

export type HepsiburadaIntegrationInput = {
  merchantId?: string;
  username?: string;
  password?: string;
  syncEnabled?: boolean;
  autoSyncIntervalMinutes?: number;
  defaultWarehouseId?: string | null;
};

export type MarketplaceIntegrationInput =
  | TrendyolIntegrationInput
  | HepsiburadaIntegrationInput;

export type IntegrationSummary = {
  channel: MarketplaceChannel;
  status: MarketplaceIntegrationStatus;
  hasCredentials: boolean;
  supplierId: string | null;
  merchantId: string | null;
  serviceUsername: string | null;
  syncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  defaultWarehouseId: string | null;
  defaultWarehouseName: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  updatedAt: string;
};

const marketplaceDb = db as typeof db & Record<string, any>;

function toSummary(
  integration: MarketplaceIntegration & {
    defaultWarehouse: { id: string; name: string } | null;
  }
): IntegrationSummary {
  return {
    channel: integration.channel,
    status: integration.status,
    hasCredentials: Boolean(integration.credentialsEncrypted),
    supplierId: integration.supplierId,
    merchantId: integration.merchantId,
    serviceUsername:
      integration.channel === "HEPSIBURADA" ? integration.supplierId : null,
    syncEnabled: integration.syncEnabled,
    autoSyncIntervalMinutes: integration.autoSyncIntervalMinutes,
    defaultWarehouseId: integration.defaultWarehouseId ?? null,
    defaultWarehouseName: integration.defaultWarehouse?.name ?? null,
    lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
    lastSyncStatus: integration.lastSyncStatus ?? null,
    lastError: integration.lastError ?? null,
    updatedAt: integration.updatedAt.toISOString(),
  };
}

async function assertWarehouseBelongsToCompany(
  companyId: string,
  warehouseId?: string | null
) {
  if (!warehouseId) return;
  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true },
  });
  if (!warehouse) {
    throw new Error("Seçilen depo bu firmaya ait değil.");
  }
}

function sanitizeInterval(value?: number) {
  if (!value || !Number.isFinite(value)) return 15;
  return Math.min(Math.max(Math.round(value), 5), 240);
}

function buildTrendyolCredentials(
  input: TrendyolIntegrationInput,
  existing?: TrendyolCredentials,
  options?: { requireFreshSecrets?: boolean }
): TrendyolCredentials {
  return resolveTrendyolCredentials(input, existing, options);
}

function buildHepsiburadaCredentials(
  input: HepsiburadaIntegrationInput,
  existing?: HepsiburadaCredentials
): HepsiburadaCredentials {
  const merchantId = input.merchantId?.trim();
  if (!merchantId) {
    throw new Error("Hepsiburada Merchant ID zorunludur.");
  }

  const password = input.password?.trim() || existing?.password;
  if (!password) {
    throw new Error("Hepsiburada API şifresi zorunludur.");
  }

  const username = input.username?.trim() || existing?.username || undefined;
  return { merchantId, username, password };
}

export async function getMarketplaceIntegrations(companyId: string) {
  const rows = await marketplaceDb.marketplaceIntegration.findMany({
    where: { companyId },
    include: {
      defaultWarehouse: { select: { id: true, name: true } },
    },
    orderBy: { channel: "asc" },
  });
  return rows.map(toSummary);
}

export async function getMarketplaceIntegration(
  companyId: string,
  channel: MarketplaceChannel
) {
  const row = await marketplaceDb.marketplaceIntegration.findUnique({
    where: { companyId_channel: { companyId, channel } },
    include: {
      defaultWarehouse: { select: { id: true, name: true } },
    },
  });
  return row ? toSummary(row) : null;
}

export async function getMarketplaceAdapter(input: {
  channel: MarketplaceChannel;
  credentialsEncrypted: string;
}) {
  if (input.channel === "TRENDYOL") {
    const credentials =
      decryptMarketplaceCredentials<TrendyolCredentials>(
        input.credentialsEncrypted
      );
    return new TrendyolAdapter(credentials);
  }

  const hbCredentials = decryptMarketplaceCredentials<HepsiburadaCredentials>(
    input.credentialsEncrypted
  );
  return new HepsiburadaAdapter(hbCredentials);
}

export async function upsertMarketplaceIntegration(input: {
  companyId: string;
  channel: MarketplaceChannel;
  data: MarketplaceIntegrationInput;
}) {
  if (input.channel !== "TRENDYOL" && input.channel !== "HEPSIBURADA") {
    throw new Error("Desteklenmeyen pazaryeri kanalı.");
  }

  assertIntegrationEncryptionConfigured();
  await assertWarehouseBelongsToCompany(
    input.companyId,
    input.data.defaultWarehouseId
  );

  const existing = await marketplaceDb.marketplaceIntegration.findUnique({
    where: {
      companyId_channel: { companyId: input.companyId, channel: input.channel },
    },
  });

  if (!existing) {
    const { requireCompanyFeature, requireCompanyLimit } = await import(
      "@/lib/billing/entitlements/entitlement-enforcement-service"
    );
    await requireCompanyFeature(input.companyId, "MARKETPLACE");
    await requireCompanyLimit(input.companyId, "MAX_MARKETPLACES", { incrementBy: 1 });
  }

  let adapter: MarketplaceAdapter;
  let credentialsEncrypted: string;
  let supplierId: string | null = null;
  let merchantId: string | null = null;

  if (input.channel === "TRENDYOL") {
    const trendyolData = input.data as TrendyolIntegrationInput;
    const existingCreds =
      existing?.credentialsEncrypted
        ? decryptMarketplaceCredentials<TrendyolCredentials>(
            existing.credentialsEncrypted
          )
        : undefined;
    const credentials = buildTrendyolCredentials(trendyolData, existingCreds, {
      requireFreshSecrets: trendyolRequiresFreshSecrets({
        hasStoredCredentials: Boolean(existing?.credentialsEncrypted),
        status: existing?.status,
      }),
    });
    credentialsEncrypted = encryptMarketplaceCredentials(credentials);
    adapter = new TrendyolAdapter(credentials);
    supplierId = credentials.supplierId;
  } else {
    const hbData = input.data as HepsiburadaIntegrationInput;
    const existingCreds =
      existing?.credentialsEncrypted
        ? decryptMarketplaceCredentials<HepsiburadaCredentials>(
            existing.credentialsEncrypted
          )
        : undefined;
    const credentials = buildHepsiburadaCredentials(hbData, existingCreds);
    credentialsEncrypted = encryptMarketplaceCredentials(credentials);
    adapter = new HepsiburadaAdapter(credentials);
    merchantId = credentials.merchantId;
    supplierId = credentials.username ?? null;
  }

  const testResult = await adapter.testConnection();
  const status: MarketplaceIntegrationStatus = testResult.ok
    ? "CONNECTED"
    : "ERROR";

  const row = await marketplaceDb.marketplaceIntegration.upsert({
    where: {
      companyId_channel: { companyId: input.companyId, channel: input.channel },
    },
    update: {
      credentialsEncrypted,
      supplierId,
      merchantId,
      syncEnabled: input.data.syncEnabled ?? existing?.syncEnabled ?? false,
      autoSyncIntervalMinutes: sanitizeInterval(
        input.data.autoSyncIntervalMinutes ?? existing?.autoSyncIntervalMinutes
      ),
      defaultWarehouseId:
        input.data.defaultWarehouseId === undefined
          ? existing?.defaultWarehouseId
          : input.data.defaultWarehouseId,
      status,
      lastError: testResult.ok ? null : testResult.message,
    },
    create: {
      companyId: input.companyId,
      channel: input.channel,
      credentialsEncrypted,
      supplierId,
      merchantId,
      syncEnabled: input.data.syncEnabled ?? false,
      autoSyncIntervalMinutes: sanitizeInterval(
        input.data.autoSyncIntervalMinutes
      ),
      defaultWarehouseId: input.data.defaultWarehouseId ?? null,
      status,
      lastError: testResult.ok ? null : testResult.message,
    },
    include: {
      defaultWarehouse: { select: { id: true, name: true } },
    },
  });

  return {
    integration: toSummary(row),
    testResult,
  };
}

export type MarketplaceCredentialsOverride =
  | {
      channel: "TRENDYOL";
      supplierId: string;
      apiKey: string;
      apiSecret: string;
    }
  | {
      channel: "HEPSIBURADA";
      merchantId: string;
      password: string;
      username?: string;
    };

export async function testMarketplaceIntegration(input: {
  companyId: string;
  channel: MarketplaceChannel;
  credentialsOverride?: MarketplaceCredentialsOverride;
}) {
  assertIntegrationEncryptionConfigured();
  let integration: MarketplaceIntegration | null = null;
  let adapter: MarketplaceAdapter;

  if (input.credentialsOverride) {
    if (
      input.channel === "TRENDYOL" &&
      input.credentialsOverride.channel === "TRENDYOL"
    ) {
      adapter = new TrendyolAdapter({
        supplierId: input.credentialsOverride.supplierId.trim(),
        apiKey: input.credentialsOverride.apiKey.trim(),
        apiSecret: input.credentialsOverride.apiSecret.trim(),
      });
    } else if (
      input.channel === "HEPSIBURADA" &&
      input.credentialsOverride.channel === "HEPSIBURADA"
    ) {
      adapter = new HepsiburadaAdapter({
        merchantId: input.credentialsOverride.merchantId.trim(),
        password: input.credentialsOverride.password.trim(),
        username: input.credentialsOverride.username?.trim() || undefined,
      });
    } else {
      throw new Error("Geçersiz test credential kanalı.");
    }
  } else {
    integration = await marketplaceDb.marketplaceIntegration.findUnique({
      where: {
        companyId_channel: { companyId: input.companyId, channel: input.channel },
      },
    });
    if (!integration?.credentialsEncrypted) {
      throw new Error("Entegrasyon kimlik bilgileri bulunamadı.");
    }
    adapter = await getMarketplaceAdapter({
      channel: integration.channel,
      credentialsEncrypted: integration.credentialsEncrypted,
    });
  }

  const result = await adapter.testConnection();
  const message =
    integration && !result.ok && !input.credentialsOverride
      ? storedCredentialTestFailureMessage(result.message)
      : result.message;

  if (integration) {
    await marketplaceDb.marketplaceIntegration.update({
      where: {
        companyId_channel: { companyId: input.companyId, channel: input.channel },
      },
      data: {
        status: result.ok ? "CONNECTED" : "ERROR",
        lastError: result.ok ? null : message,
      },
    });
  }

  return { ok: result.ok, message };
}

export async function disconnectMarketplaceIntegration(input: {
  companyId: string;
  channel: MarketplaceChannel;
}) {
  const row = await marketplaceDb.marketplaceIntegration.update({
    where: {
      companyId_channel: { companyId: input.companyId, channel: input.channel },
    },
    data: {
      status: "DISCONNECTED",
      credentialsEncrypted: null,
      syncEnabled: false,
      lastError: null,
      supplierId: null,
      merchantId: null,
    },
    include: {
      defaultWarehouse: { select: { id: true, name: true } },
    },
  });
  return toSummary(row);
}

export async function listMarketplaceSyncRuns(input: {
  companyId: string;
  channel?: MarketplaceChannel;
  limit?: number;
}) {
  const rows = await marketplaceDb.marketplaceSyncRun.findMany({
    where: {
      companyId: input.companyId,
      ...(input.channel ? { channel: input.channel } : {}),
    },
    include: {
      integration: { select: { channel: true } },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 20, 1), 100),
  });

  return rows.map((row: {
    id: string;
    channel: string;
    type: string;
    status: string;
    fetchedCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errors: unknown;
    startedAt: Date;
    finishedAt: Date | null;
    createdAt: Date;
  }) => ({
    id: row.id,
    channel: row.channel,
    type: row.type,
    status: row.status,
    fetchedCount: row.fetchedCount,
    createdCount: row.createdCount,
    updatedCount: row.updatedCount,
    skippedCount: row.skippedCount,
    errors: row.errors,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export function assertOwnerOrAdmin(input: {
  role: string;
  isOwner?: boolean;
}) {
  if (input.isOwner) return;
  if (input.role === "ADMIN" || input.role === "SUPER_ADMIN") return;
  throw new Error("Bu işlem için yönetici yetkisi gerekir.");
}
