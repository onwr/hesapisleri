import "server-only";

import type {
  EDocumentProvider,
  EfaturamConnectionMode,
  EfaturamEnvironment,
  EfaturamIntegrationStatus,
} from "@prisma/client";
import { getEfaturamPartnerConfig } from "@/lib/efaturam/efaturam-config";
import { efinansAdapter, readEfinansCredentialHints } from "@/lib/e-document/adapters/efinans-adapter";
import { sovosAdapter, readSovosCredentialHints, readSovosCapabilitiesFromIntegration } from "@/lib/e-document/adapters/sovos-adapter";
import { trendyolEfaturamAdapter } from "@/lib/e-document/adapters/trendyol-efaturam-adapter";
import type { SovosCapabilities } from "@/lib/e-document/sovos-capabilities";
import type { EDocumentUpsertInput } from "@/lib/e-document/adapters/e-document-adapter-types";
import {
  getEDocumentProviderMeta,
  isEDocumentProviderConnectionReady,
} from "@/lib/e-document/e-document-provider-registry";
import { maskSecretUsername } from "@/lib/e-document/e-document-crypto";
import { assertEDocumentProviderPayloadIsolation } from "@/lib/e-document/e-document-payload-guard";
import { db } from "@/lib/prisma";

export type EDocumentIntegrationSummary = {
  hasSavedIntegration: boolean;
  provider: EDocumentProvider | null;
  providerLabel: string;
  providerConnectionReady: boolean;
  status: EfaturamIntegrationStatus;
  connectionMode: EfaturamConnectionMode | null;
  environment: EfaturamEnvironment | null;
  prefix: string | null;
  xsltCode: string | null;
  externalCompanyCode: string | null;
  taxId: string | null;
  senderIdentifier: string | null;
  receiverIdentifier: string | null;
  branchCode: string | null;
  invoiceSeries: string | null;
  archiveSeries: string | null;
  capabilities: SovosCapabilities | null;
  providerCompanyId: string | null;
  providerUserId: string | null;
  partnerCustomerId: string | null;
  hasCredentials: boolean;
  hasSavedPassword: boolean;
  savedUsername: string | null;
  savedArchiveUsername: string | null;
  hasSavedInvoicePassword: boolean;
  hasSavedArchivePassword: boolean;
  useSameArchiveCredentials: boolean;
  tokenExpiresAt: string | null;
  lastConnectedAt: string | null;
  lastTestedAt: string | null;
  lastSuccessfulAt: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: string | null;
  partnerModeAvailable: boolean;
};

const adapters = {
  TRENDYOL_EFATURAM: trendyolEfaturamAdapter,
  EFINANS: efinansAdapter,
  SOVOS: sovosAdapter,
} as const;

function getEDocumentModel() {
  const model = (db as typeof db & { efaturamIntegration?: typeof db.efaturamIntegration })
    .efaturamIntegration;
  return model ?? null;
}

function getAdapter(provider: EDocumentProvider) {
  if (provider === "OTHER") {
    throw new Error("Bu sağlayıcı henüz desteklenmiyor.");
  }
  return adapters[provider];
}

function toSummary(
  integration: Awaited<ReturnType<typeof db.efaturamIntegration.findUnique>>
): EDocumentIntegrationSummary {
  const partner = getEfaturamPartnerConfig();

  if (!integration) {
    return {
      hasSavedIntegration: false,
      provider: null,
      providerLabel: "—",
      providerConnectionReady: false,
      status: "DISCONNECTED",
      connectionMode: null,
      environment: null,
      prefix: null,
      xsltCode: null,
      externalCompanyCode: null,
      taxId: null,
      senderIdentifier: null,
      receiverIdentifier: null,
      branchCode: null,
      invoiceSeries: null,
      archiveSeries: null,
      capabilities: null,
      providerCompanyId: null,
      providerUserId: null,
      partnerCustomerId: null,
      hasCredentials: false,
      hasSavedPassword: false,
      savedUsername: null,
      savedArchiveUsername: null,
      hasSavedInvoicePassword: false,
      hasSavedArchivePassword: false,
      useSameArchiveCredentials: true,
      tokenExpiresAt: null,
      lastConnectedAt: null,
      lastTestedAt: null,
      lastSuccessfulAt: null,
      lastError: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      updatedAt: null,
      partnerModeAvailable: partner.enabled,
    };
  }

  const meta = getEDocumentProviderMeta(integration.provider);
  const efinansHints =
    integration.provider === "EFINANS"
      ? readEfinansCredentialHints(integration.credentialsEncrypted)
      : null;
  const sovosHints =
    integration.provider === "SOVOS"
      ? readSovosCredentialHints(integration.credentialsEncrypted)
      : null;

  return {
    hasSavedIntegration: true,
    provider: integration.provider,
    providerLabel: meta.label,
    providerConnectionReady: isEDocumentProviderConnectionReady(integration.provider),
    status: integration.status,
    connectionMode: integration.connectionMode,
    environment: integration.environment,
    prefix: integration.prefix,
    xsltCode: integration.xsltCode,
    externalCompanyCode: integration.externalCompanyCode,
    taxId: integration.taxId,
    senderIdentifier: integration.senderIdentifier,
    receiverIdentifier: integration.receiverIdentifier,
    branchCode: integration.branchCode,
    invoiceSeries: integration.invoiceSeries,
    archiveSeries: integration.archiveSeries,
    capabilities:
      integration.provider === "SOVOS"
        ? readSovosCapabilitiesFromIntegration(integration.capabilities)
        : null,
    providerCompanyId: integration.providerCompanyId,
    providerUserId: integration.providerUserId,
    partnerCustomerId: integration.partnerCustomerId,
    hasCredentials: Boolean(integration.credentialsEncrypted),
    hasSavedPassword:
      integration.provider === "EFINANS"
        ? (efinansHints?.hasSavedPassword ?? false)
        : integration.provider === "SOVOS"
          ? (sovosHints?.hasSavedInvoicePassword ?? false)
          : Boolean(integration.credentialsEncrypted),
    savedUsername:
      integration.provider === "EFINANS"
        ? maskSecretUsername(efinansHints?.username)
        : integration.provider === "SOVOS"
          ? maskSecretUsername(sovosHints?.invoiceUsername)
          : null,
    savedArchiveUsername:
      integration.provider === "SOVOS"
        ? maskSecretUsername(sovosHints?.archiveUsername)
        : null,
    hasSavedInvoicePassword: sovosHints?.hasSavedInvoicePassword ?? false,
    hasSavedArchivePassword: sovosHints?.hasSavedArchivePassword ?? false,
    useSameArchiveCredentials: sovosHints?.useSameArchiveCredentials ?? true,
    tokenExpiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    lastConnectedAt: integration.lastConnectedAt?.toISOString() ?? null,
    lastTestedAt: integration.lastTestedAt?.toISOString() ?? null,
    lastSuccessfulAt: integration.lastSuccessfulAt?.toISOString() ?? null,
    lastError: integration.lastError,
    lastErrorCode: integration.lastErrorCode,
    lastErrorMessage: integration.lastErrorMessage,
    updatedAt: integration.updatedAt.toISOString(),
    partnerModeAvailable: partner.enabled,
  };
}

export async function getEDocumentIntegrationSummary(companyId: string) {
  const model = getEDocumentModel();
  if (!model) {
    return toSummary(null);
  }
  const integration = await model.findUnique({
    where: { companyId },
  });
  return toSummary(integration);
}

export function assertOwnerOrAdmin(input: {
  role: string;
  isOwner: boolean;
}) {
  if (
    input.isOwner ||
    input.role === "OWNER" ||
    input.role === "ADMIN" ||
    input.role === "SUPER_ADMIN"
  ) {
    return;
  }
  throw new Error("Bu işlem için yönetici yetkisi gerekir.");
}

export async function upsertEDocumentIntegration(input: EDocumentUpsertInput) {
  const model = getEDocumentModel();
  if (!model) {
    throw new Error(
      "E-belge modeli henüz hazır değil. Sunucuyu yeniden başlatıp prisma generate çalıştırın."
    );
  }

  if (input.provider === "OTHER") {
    throw new Error("Diğer sağlayıcılar yakında eklenecek.");
  }

  assertEDocumentProviderPayloadIsolation(input);

  try {
    const integration = await getAdapter(input.provider).upsert(input);
    return toSummary(integration);
  } catch (error) {
    if (input.provider === "TRENDYOL_EFATURAM") {
      const message =
        error instanceof Error ? error.message : "E-Faturam bağlantısı kurulamadı.";

      await model.upsert({
        where: { companyId: input.companyId },
        create: {
          companyId: input.companyId,
          provider: "TRENDYOL_EFATURAM",
          connectionMode: input.connectionMode,
          environment: input.environment,
          status: "ERROR",
          prefix: input.prefix ?? null,
          xsltCode: input.xsltCode ?? null,
          lastError: message,
        },
        update: {
          provider: "TRENDYOL_EFATURAM",
          connectionMode: input.connectionMode,
          environment: input.environment,
          status: "ERROR",
          prefix: input.prefix ?? null,
          xsltCode: input.xsltCode ?? null,
          lastError: message,
        },
      });
    }

    throw error;
  }
}

export async function disconnectEDocumentIntegration(companyId: string) {
  const model = getEDocumentModel();
  if (!model) {
    return toSummary(null);
  }

  const existing = await model.findUnique({
    where: { companyId },
  });
  if (!existing) return toSummary(null);

  if (existing.provider === "OTHER") {
    await model.delete({ where: { companyId } });
    return toSummary(null);
  }

  const integration = await getAdapter(existing.provider).disconnect(companyId);
  return toSummary(integration);
}

export async function testEDocumentIntegration(companyId: string) {
  const model = getEDocumentModel();
  if (!model) {
    throw new Error(
      "E-belge modeli henüz hazır değil. Sunucuyu yeniden başlatıp prisma generate çalıştırın."
    );
  }

  const integration = await model.findUnique({
    where: { companyId },
  });

  if (!integration) {
    throw new Error("E-belge bağlantısı bulunamadı.");
  }

  if (integration.provider === "OTHER") {
    return {
      ok: false,
      message: "Bu sağlayıcı henüz desteklenmiyor.",
    };
  }

  return getAdapter(integration.provider).test(companyId);
}

// Backward-compatible aliases
export const getEfaturamIntegrationSummary = getEDocumentIntegrationSummary;
export type EfaturamIntegrationSummary = EDocumentIntegrationSummary;
