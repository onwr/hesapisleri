import crypto from "node:crypto";
import type { DistributedKv, DistributedKvLockResult } from "./distributed-kv";

const LOCK_PREFIX = "lock:";
const RELEASE_LOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export async function createRedisDistributedKv(redisUrl: string): Promise<DistributedKv> {
  const { createClient } = await import("redis");
  const client = createClient({ url: redisUrl });
  client.on("error", () => {
    /* bağlantı hataları üst katmanda fallback ile ele alınır */
  });
  await client.connect();

  return {
    async get(key: string): Promise<string | null> {
      const value = await client.get(key);
      return value ?? null;
    },

    async set(key: string, value: string, options: { ttlMs: number }): Promise<void> {
      const ttlSec = Math.max(1, Math.ceil(options.ttlMs / 1000));
      await client.set(key, value, { EX: ttlSec });
    },

    async del(key: string): Promise<void> {
      await client.del(key);
    },

    async acquireLock(key: string, ttlMs: number): Promise<DistributedKvLockResult> {
      const token = crypto.randomBytes(16).toString("hex");
      const lockKey = `${LOCK_PREFIX}${key}`;
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      const result = await client.set(lockKey, token, { NX: true, EX: ttlSec });
      if (result === "OK") {
        return { acquired: true, token };
      }
      return { acquired: false };
    },

    async releaseLock(key: string, token: string): Promise<void> {
      const lockKey = `${LOCK_PREFIX}${key}`;
      await client.eval(RELEASE_LOCK_SCRIPT, {
        keys: [lockKey],
        arguments: [token],
      });
    },
  };
}
