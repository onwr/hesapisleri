import { sipayPostToken } from "./sipay-client";
import { SipayTokenError, SipayCapabilityError } from "./sipay-errors";
import { IS3D_CAPABILITY, type SipayIs3dCapability, type SipayTokenResponse } from "./sipay-types";
import { sipayTokenResponseSchema } from "./sipay-schemas";
import { getOrCreateDistributedKv } from "@/lib/cache/distributed-kv-factory";

import { SIPAY_ENDPOINTS } from "./sipay-endpoints";
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 15_000;
const TOKEN_CACHE_KEY_PREFIX = "sipay:token:";

type TokenCacheEntry = {
  token: string;
  expiresAt: string;
  is3d: SipayIs3dCapability;
};

type TokenCacheKeyInput = {
  baseUrl: string;
  appId: string;
  sipayEnv: string;
};

const memoryCache = new Map<string, TokenCacheEntry>();
const inflight = new Map<string, Promise<TokenCacheEntry>>();
const refreshAttempts = new Map<string, number>();

function cacheKey(input: TokenCacheKeyInput): string {
  return `${TOKEN_CACHE_KEY_PREFIX}${input.sipayEnv}:${input.baseUrl}:${input.appId}`;
}

function lockKey(cacheKeyValue: string): string {
  return `${cacheKeyValue}:lock`;
}

function isCacheValid(entry: TokenCacheEntry): boolean {
  const expiresAt = new Date(entry.expiresAt).getTime();
  return expiresAt - Date.now() > REFRESH_BEFORE_EXPIRY_MS;
}

function ttlUntilExpiry(expiresAt: Date): number {
  return Math.max(1_000, expiresAt.getTime() - Date.now() - REFRESH_BEFORE_EXPIRY_MS);
}

async function readMemory(cacheKeyValue: string): Promise<TokenCacheEntry | null> {
  const entry = memoryCache.get(cacheKeyValue);
  if (!entry || !isCacheValid(entry)) return null;
  return entry;
}

async function readRedis(cacheKeyValue: string): Promise<TokenCacheEntry | null> {
  try {
    const kv = await getOrCreateDistributedKv();
    const raw = await kv.get(cacheKeyValue);
    if (!raw) return null;
    const entry = JSON.parse(raw) as TokenCacheEntry;
    if (!isCacheValid(entry)) {
      await kv.del(cacheKeyValue);
      return null;
    }
    memoryCache.set(cacheKeyValue, entry);
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(cacheKeyValue: string, entry: TokenCacheEntry): Promise<void> {
  memoryCache.set(cacheKeyValue, entry);
  try {
    const kv = await getOrCreateDistributedKv();
    await kv.set(cacheKeyValue, JSON.stringify(entry), {
      ttlMs: ttlUntilExpiry(new Date(entry.expiresAt)),
    });
  } catch {
    /* memory fallback yeterli */
  }
}

async function fetchNewToken(
  baseUrl: string,
  appId: string,
  appSecret: string,
): Promise<TokenCacheEntry> {
  const raw = await sipayPostToken<SipayTokenResponse>(baseUrl, SIPAY_ENDPOINTS.TOKEN, {
    app_id: appId,
    app_secret: appSecret,
  });

  const parsed = sipayTokenResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new SipayTokenError(`Sipay token response schema invalid: ${parsed.error.message}`);
  }

  const res = parsed.data;
  if (res.status_code === 30) {
    throw new SipayTokenError(`Sipay token invalid credentials: ${res.status_description}`);
  }
  if (res.status_code !== 100 || !res.data) {
    throw new SipayTokenError(
      `Sipay token failed: ${res.status_code} — ${res.status_description}`,
    );
  }

  const expiresAt = new Date(res.data.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new SipayTokenError("Sipay token expires_at invalid");
  }

  return {
    token: res.data.token,
    expiresAt: expiresAt.toISOString(),
    is3d: res.data.is_3d,
  };
}

async function acquireTokenWithLock(
  cacheKeyValue: string,
  fetcher: () => Promise<TokenCacheEntry>,
): Promise<TokenCacheEntry> {
  const kv = await getOrCreateDistributedKv();
  const lock = await kv.acquireLock(lockKey(cacheKeyValue), LOCK_TTL_MS);

  if (!lock.acquired) {
    const cached = (await readRedis(cacheKeyValue)) ?? (await readMemory(cacheKeyValue));
    if (cached) return cached;
    await new Promise((resolve) => setTimeout(resolve, 150));
    const retry = (await readRedis(cacheKeyValue)) ?? (await readMemory(cacheKeyValue));
    if (retry) return retry;
  }

  try {
    const afterLock = (await readRedis(cacheKeyValue)) ?? (await readMemory(cacheKeyValue));
    if (afterLock) return afterLock;

    const entry = await fetcher();
    await writeCache(cacheKeyValue, entry);
    return entry;
  } finally {
    if (lock.acquired) {
      await kv.releaseLock(lockKey(cacheKeyValue), lock.token).catch(() => undefined);
    }
  }
}

export async function getSipayToken(params: {
  baseUrl: string;
  appId: string;
  appSecret: string;
  sipayEnv?: string;
}): Promise<{ token: string; is3d: SipayIs3dCapability }> {
  const { baseUrl, appId, appSecret } = params;
  const sipayEnv = params.sipayEnv ?? process.env.SIPAY_ENV ?? "test";
  const key = cacheKey({ baseUrl, appId, sipayEnv });

  const cached = (await readMemory(key)) ?? (await readRedis(key));
  if (cached) {
    return { token: cached.token, is3d: cached.is3d };
  }

  const existing = inflight.get(key);
  if (existing) {
    const entry = await existing;
    return { token: entry.token, is3d: entry.is3d };
  }

  const promise = acquireTokenWithLock(key, () => fetchNewToken(baseUrl, appId, appSecret))
    .then((entry) => {
      inflight.delete(key);
      refreshAttempts.delete(key);
      return entry;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  const entry = await promise;
  return { token: entry.token, is3d: entry.is3d };
}

export async function invalidateSipayTokenCache(input: {
  baseUrl: string;
  appId: string;
  sipayEnv?: string;
}): Promise<void> {
  const sipayEnv = input.sipayEnv ?? process.env.SIPAY_ENV ?? "test";
  const key = cacheKey({ baseUrl: input.baseUrl, appId: input.appId, sipayEnv });
  memoryCache.delete(key);
  inflight.delete(key);
  try {
    const kv = await getOrCreateDistributedKv();
    await kv.del(key);
  } catch {
    /* ignore */
  }
}

export async function handleSipayTokenUnauthorized(input: {
  baseUrl: string;
  appId: string;
  appSecret: string;
  sipayEnv?: string;
}): Promise<{ token: string; is3d: SipayIs3dCapability } | null> {
  const sipayEnv = input.sipayEnv ?? process.env.SIPAY_ENV ?? "test";
  const key = cacheKey({ baseUrl: input.baseUrl, appId: input.appId, sipayEnv });
  const attempts = refreshAttempts.get(key) ?? 0;
  if (attempts >= 1) {
    return null;
  }
  refreshAttempts.set(key, attempts + 1);
  await invalidateSipayTokenCache(input);
  return getSipayToken(input);
}

export function assertBrandedCheckoutSupported(is3d: SipayIs3dCapability): void {
  if (is3d === IS3D_CAPABILITY.UNSUPPORTED) {
    throw new SipayCapabilityError(
      `Sipay account does not support branded checkout (is_3d=${is3d})`,
    );
  }
}

export function _clearSipayTokenCache(): void {
  memoryCache.clear();
  inflight.clear();
  refreshAttempts.clear();
}

export const _resetTokenCache = _clearSipayTokenCache;
