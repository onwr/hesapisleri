/**
 * Distributed key-value store abstraction.
 * Redis bağlandığında multi-instance güvenli; yoksa process memory fallback.
 */
export type DistributedKvSetOptions = {
  ttlMs: number;
};

export type DistributedKvLockResult =
  | { acquired: true; token: string }
  | { acquired: false };

export interface DistributedKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: DistributedKvSetOptions): Promise<void>;
  del(key: string): Promise<void>;
  acquireLock(key: string, ttlMs: number): Promise<DistributedKvLockResult>;
  releaseLock(key: string, token: string): Promise<void>;
}

let activeKv: DistributedKv | null = null;

export function registerDistributedKv(store: DistributedKv): void {
  activeKv = store;
}

export function getDistributedKv(): DistributedKv {
  if (!activeKv) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMemoryDistributedKv } = require("./memory-distributed-kv") as typeof import("./memory-distributed-kv");
    activeKv = createMemoryDistributedKv();
  }
  return activeKv;
}

export function resetDistributedKvForTests(): void {
  activeKv = null;
}

export function hasExternalDistributedKv(): boolean {
  return activeKv != null && activeKv.constructor.name !== "MemoryDistributedKv";
}
