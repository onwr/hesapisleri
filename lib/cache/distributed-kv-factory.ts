import type { DistributedKv } from "./distributed-kv";
import { createMemoryDistributedKv } from "./memory-distributed-kv";

/**
 * Redis URL yapılandırılmışsa Redis KV döner; aksi halde memory fallback.
 * REDIS_URL veya SIPAY_TOKEN_REDIS_URL veya AI_RATE_LIMIT_REDIS_URL kullanılır.
 */
export async function createDistributedKvFromEnv(): Promise<DistributedKv> {
  const redisUrl =
    process.env.SIPAY_TOKEN_REDIS_URL?.trim() ||
    process.env.REDIS_URL?.trim() ||
    process.env.AI_RATE_LIMIT_REDIS_URL?.trim();

  if (!redisUrl) {
    return createMemoryDistributedKv();
  }

  try {
    const { createRedisDistributedKv } = await import("./redis-distributed-kv");
    return await createRedisDistributedKv(redisUrl);
  } catch (error) {
    console.warn(
      "[distributed-kv] Redis bağlantısı kurulamadı, memory fallback kullanılıyor:",
      error instanceof Error ? error.message : "unknown",
    );
    return createMemoryDistributedKv();
  }
}

let kvSingleton: DistributedKv | null = null;

export async function getOrCreateDistributedKv(): Promise<DistributedKv> {
  if (!kvSingleton) {
    kvSingleton = await createDistributedKvFromEnv();
  }
  return kvSingleton;
}

export function resetDistributedKvSingleton(): void {
  kvSingleton = null;
}
