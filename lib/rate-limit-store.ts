/**
 * Distributed rate limit store interface.
 *
 * Production serverless multi-instance ortamında in-memory rate limit
 * (lib/rate-limit.ts) instance başına çalışır; global sınır sağlamaz.
 * Redis/Upstash gibi ortak store bağlandığında bu adapter kullanılmalıdır.
 */
export type RateLimitStoreResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSec: number };

export interface RateLimitStore {
  check(input: { key: string; limit: number; windowMs: number }): Promise<RateLimitStoreResult>;
}

let distributedStore: RateLimitStore | null = null;

export function registerDistributedRateLimitStore(store: RateLimitStore) {
  distributedStore = store;
}

export function getDistributedRateLimitStore() {
  return distributedStore;
}

export function hasDistributedRateLimitStore() {
  return distributedStore != null;
}
