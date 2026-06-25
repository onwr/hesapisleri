import "server-only";

import type { EfaturamEnvironment } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { SovosStoredCredentials } from "@/lib/e-document/adapters/sovos-adapter";
import { filterGibUserAliasesByTaxId } from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { fetchSovosRawUserListZip } from "@/lib/e-document/providers/sovos/sovos-user-list-client";
import { extractXmlFromUserListZip } from "@/lib/e-document/taxpayer/gib-user-list-zip";
import { SOVOS_TAXPAYER_SYNC_OPERATION } from "@/lib/e-document/taxpayer/gib-user-list-parser";
import { db } from "@/lib/prisma";

const USER_LIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const syncLocks = new Map<string, Promise<Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>>>>();

function buildUserIndex(xmlParts: string[]) {
  const taxIds = new Set<string>();
  for (const xml of xmlParts) {
    const matches = [...xml.matchAll(/<(?:VKN_TCKN|vknTckn|VknTckn)[^>]*>([^<]+)<\//gi)];
    for (const match of matches) {
      const taxId = match[1]?.replace(/\D/g, "");
      if (taxId) taxIds.add(taxId);
    }
  }

  const index: Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>> = {};
  for (const taxId of taxIds) {
    index[taxId] = filterGibUserAliasesByTaxId(xmlParts, taxId);
  }
  return index;
}

export async function readGibUserListCache(companyId: string, includeStale = false) {
  const row = await db.eDocumentGibUserListCache.findUnique({ where: { companyId } });
  if (!row) return null;
  if (!includeStale && row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

async function writeGibUserListCache(
  companyId: string,
  userIndex: Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>>
) {
  const expiresAt = new Date(Date.now() + USER_LIST_CACHE_TTL_MS);
  const syncedAt = new Date();
  const userIndexJson = userIndex as Prisma.InputJsonValue;
  await db.eDocumentGibUserListCache.upsert({
    where: { companyId },
    create: {
      companyId,
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      userIndex: userIndexJson,
      syncedAt,
      expiresAt,
    },
    update: {
      syncOperation: SOVOS_TAXPAYER_SYNC_OPERATION,
      userIndex: userIndexJson,
      syncedAt,
      expiresAt,
    },
  });
  return userIndex;
}

export async function syncGibUserListCacheForTenant(input: {
  companyId: string;
  environment: EfaturamEnvironment;
  credentials: SovosStoredCredentials;
  integratorTaxId: string;
  senderIdentifier?: string | null;
  fetchImpl?: typeof fetch;
}) {
  const existingLock = syncLocks.get(input.companyId);
  if (existingLock) return existingLock;

  const task = (async () => {
    const { zipBuffer } = await fetchSovosRawUserListZip({
      environment: input.environment,
      credentials: {
        username: input.credentials.invoiceUsername,
        password: input.credentials.invoicePassword,
      },
      integratorTaxId: input.integratorTaxId,
      senderIdentifier: input.senderIdentifier,
      fetchImpl: input.fetchImpl,
    });

    const xmlParts = extractXmlFromUserListZip(zipBuffer);
    const userIndex = buildUserIndex(xmlParts);
    return writeGibUserListCache(input.companyId, userIndex);
  })();

  syncLocks.set(input.companyId, task);
  try {
    return await task;
  } finally {
    syncLocks.delete(input.companyId);
  }
}

export async function getGibUserListIndex(input: {
  companyId: string;
  environment: EfaturamEnvironment;
  credentials: SovosStoredCredentials;
  integratorTaxId: string;
  senderIdentifier?: string | null;
  fetchImpl?: typeof fetch;
  allowStaleOnFailure?: boolean;
}): Promise<{
  userIndex: Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>> | null;
  cacheHit: boolean;
  stale: boolean;
  providerError: "STALE_CACHE" | "PROVIDER_UNAVAILABLE" | null;
}> {
  const fresh = await readGibUserListCache(input.companyId, false);
  if (fresh) {
    return {
      userIndex: fresh.userIndex as Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>>,
      cacheHit: true,
      stale: false,
      providerError: null,
    };
  }

  try {
    const userIndex = await syncGibUserListCacheForTenant(input);
    return { userIndex, cacheHit: false, stale: false, providerError: null };
  } catch {
    if (!input.allowStaleOnFailure) {
      return { userIndex: null, cacheHit: false, stale: false, providerError: "PROVIDER_UNAVAILABLE" };
    }

    const stale = await readGibUserListCache(input.companyId, true);
    if (stale) {
      return {
        userIndex: stale.userIndex as Record<string, ReturnType<typeof filterGibUserAliasesByTaxId>>,
        cacheHit: true,
        stale: true,
        providerError: "STALE_CACHE",
      };
    }

    return { userIndex: null, cacheHit: false, stale: false, providerError: "PROVIDER_UNAVAILABLE" };
  }
}
