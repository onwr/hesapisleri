import "server-only";

import type { HealthCheckResult } from "@/lib/admin/system-health/system-health-registry";

const CACHE_TTL_MS = 20_000;
const RUN_COOLDOWN_MS = 5_000;

type CacheEntry = {
  expiresAt: number;
  payload: {
    checks: HealthCheckResult[];
    errorsLast24h: number;
  };
};

let healthCache: CacheEntry | null = null;

/** Namespaced in-memory probe store (health cache only). */
const probeStore = new Map<string, { value: string; expiresAt: number }>();

const lastRunAt = new Map<string, number>();

export function getCachedHealthSnapshot():
  | { checks: HealthCheckResult[]; errorsLast24h: number }
  | null {
  if (!healthCache || healthCache.expiresAt < Date.now()) {
    healthCache = null;
    return null;
  }
  return healthCache.payload;
}

export function setCachedHealthSnapshot(
  checks: HealthCheckResult[],
  errorsLast24h: number
): void {
  healthCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload: { checks, errorsLast24h },
  };
}

export function invalidateHealthCache(): void {
  healthCache = null;
}

export function assertRunCooldown(checkId: string): void {
  const last = lastRunAt.get(checkId) ?? 0;
  if (Date.now() - last < RUN_COOLDOWN_MS) {
    throw new Error("Kontrol cooldown süresinde; lütfen birkaç saniye bekleyin.");
  }
  lastRunAt.set(checkId, Date.now());
}

export function runCacheProbe(): { ok: boolean; backend: string } {
  const key = "system-health-probe";
  const token = `${Date.now()}`;
  probeStore.set(key, { value: token, expiresAt: Date.now() + 5_000 });
  const read = probeStore.get(key);
  const ok = read?.value === token;
  return { ok, backend: "in-memory-namespaced" };
}
