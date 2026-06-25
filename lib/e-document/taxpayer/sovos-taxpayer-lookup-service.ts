import "server-only";

import type { EDocumentProvider, EfaturamEnvironment } from "@prisma/client";
import { decryptEDocumentCredentials } from "@/lib/e-document/e-document-crypto";
import type { SovosStoredCredentials } from "@/lib/e-document/adapters/sovos-adapter";
import {
  normalizeTaxpayerFromAliases,
  SOVOS_TAXPAYER_LOOKUP_METHOD,
  SOVOS_TAXPAYER_SYNC_OPERATION,
  type NormalizedTaxpayerResult,
} from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { getGibUserListIndex } from "@/lib/e-document/taxpayer/gib-user-list-sync-service";
import { db } from "@/lib/prisma";

const LOOKUP_CACHE_TTL_MS = 15 * 60 * 1000;

export type SovosTaxpayerLookupResult = NormalizedTaxpayerResult & {
  providerError?: string | null;
  cacheHit: boolean;
  staleCache: boolean;
  syncOperation: typeof SOVOS_TAXPAYER_SYNC_OPERATION;
};

async function readLookupCache(companyId: string, taxId: string) {
  const row = await db.eDocumentTaxpayerLookupCache.findUnique({
    where: { companyId_taxId: { companyId, taxId } },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return row.result as NormalizedTaxpayerResult;
}

async function writeLookupCache(companyId: string, taxId: string, result: NormalizedTaxpayerResult) {
  const expiresAt = new Date(Date.now() + LOOKUP_CACHE_TTL_MS);
  await db.eDocumentTaxpayerLookupCache.upsert({
    where: { companyId_taxId: { companyId, taxId } },
    create: { companyId, taxId, result, expiresAt },
    update: { result, expiresAt },
  });
}

export async function lookupSovosTaxpayer(input: {
  companyId: string;
  taxId: string;
  fetchImpl?: typeof fetch;
}): Promise<SovosTaxpayerLookupResult> {
  const normalizedTaxId = input.taxId.replace(/\D/g, "");
  if (!normalizedTaxId) {
    return {
      taxId: "",
      registered: false,
      status: "NOT_FOUND",
      pkAliases: [],
      activePkAliases: [],
      recommendedDocumentType: "E_ARCHIVE",
      lookupOperation: "none",
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      providerError: "Geçersiz VKN/TCKN.",
      cacheHit: false,
      staleCache: false,
    };
  }

  const cached = await readLookupCache(input.companyId, normalizedTaxId);
  if (cached) {
    return {
      ...cached,
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      cacheHit: true,
      staleCache: false,
      providerError: null,
    };
  }

  const integration = await db.efaturamIntegration.findUnique({
    where: { companyId: input.companyId },
  });

  if (!integration || integration.provider !== ("SOVOS" as EDocumentProvider)) {
    return {
      ...normalizeTaxpayerFromAliases(normalizedTaxId, [], "none"),
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      cacheHit: false,
      staleCache: false,
      providerError: "Sovos entegrasyonu yapılandırılmamış.",
    };
  }

  const credentials = decryptEDocumentCredentials<SovosStoredCredentials>(
    integration.credentialsEncrypted
  );
  if (!credentials?.invoiceUsername || !credentials.invoicePassword) {
    return {
      ...normalizeTaxpayerFromAliases(normalizedTaxId, [], "none"),
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      cacheHit: false,
      staleCache: false,
      providerError: "Sovos e-Fatura kimlik bilgileri eksik.",
    };
  }

  const integratorTaxId = integration.taxId?.replace(/\D/g, "") ?? "";
  if (!integratorTaxId) {
    return {
      ...normalizeTaxpayerFromAliases(normalizedTaxId, [], "none"),
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      cacheHit: false,
      staleCache: false,
      providerError: "Entegrasyon VKN/TCKN tanımlı değil.",
    };
  }

  const listResult = await getGibUserListIndex({
    companyId: input.companyId,
    environment: integration.environment as EfaturamEnvironment,
    credentials,
    integratorTaxId,
    senderIdentifier: integration.senderIdentifier,
    fetchImpl: input.fetchImpl,
    allowStaleOnFailure: true,
  });

  if (!listResult.userIndex) {
    return {
      ...normalizeTaxpayerFromAliases(normalizedTaxId, [], "none"),
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      cacheHit: false,
      staleCache: false,
      providerError: listResult.providerError ?? "PROVIDER_UNAVAILABLE",
    };
  }

  const aliases = listResult.userIndex[normalizedTaxId] ?? [];
  const normalized = normalizeTaxpayerFromAliases(
    normalizedTaxId,
    aliases,
    SOVOS_TAXPAYER_LOOKUP_METHOD
  );

  if (!listResult.stale) {
    await writeLookupCache(input.companyId, normalizedTaxId, normalized);
  }

  return {
    ...normalized,
    syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
    cacheHit: listResult.cacheHit,
    staleCache: listResult.stale,
    providerError: listResult.providerError,
  };
}
