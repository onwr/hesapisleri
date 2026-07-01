import crypto from "node:crypto";
import type { DistributedKv, DistributedKvLockResult } from "./distributed-kv";

type Entry = { value: string; expiresAt: number };
type LockEntry = { token: string; expiresAt: number };

export class MemoryDistributedKv implements DistributedKv {
  private readonly values: Map<string, Entry>;
  private readonly locks: Map<string, LockEntry>;

  constructor(shared?: { values: Map<string, Entry>; locks: Map<string, LockEntry> }) {
    this.values = shared?.values ?? new Map();
    this.locks = shared?.locks ?? new Map();
  }

  private prune(now = Date.now()): void {
    for (const [key, entry] of this.values) {
      if (entry.expiresAt <= now) this.values.delete(key);
    }
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt <= now) this.locks.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.prune();
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, options: { ttlMs: number }): Promise<void> {
    this.prune();
    this.values.set(key, { value, expiresAt: Date.now() + options.ttlMs });
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
    this.locks.delete(key);
  }

  async acquireLock(key: string, ttlMs: number): Promise<DistributedKvLockResult> {
    this.prune();
    const existing = this.locks.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return { acquired: false };
    }
    const token = crypto.randomBytes(16).toString("hex");
    this.locks.set(key, { token, expiresAt: Date.now() + ttlMs });
    return { acquired: true, token };
  }

  async releaseLock(key: string, token: string): Promise<void> {
    const existing = this.locks.get(key);
    if (existing?.token === token) {
      this.locks.delete(key);
    }
  }
}

/** Paylaşılan bellek store — testlerde multi-instance simülasyonu için */
export function createSharedMemoryDistributedKv(shared?: {
  values: Map<string, Entry>;
  locks: Map<string, LockEntry>;
}): DistributedKv {
  return new MemoryDistributedKv(shared);
}

export function createMemoryDistributedKv(): DistributedKv {
  return new MemoryDistributedKv();
}
