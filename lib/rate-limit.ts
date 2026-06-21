import {
  getDistributedRateLimitStore,
  hasDistributedRateLimitStore,
} from "@/lib/rate-limit-store";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSec: number };

export async function checkRateLimitAsync(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const store = getDistributedRateLimitStore();
  if (store) return store.check(input);
  return checkRateLimit(input);
}

/**
 * In-memory rate limit. Serverless multi-instance ortamında instance başına
 * uygulanır; production'da distributed store yoksa global sınır garanti edilmez.
 * @see lib/rate-limit-store.ts
 */
export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return { allowed: true, remaining: input.limit - 1, resetAt };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: input.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

export function buildCouponValidateRateLimitKey(input: {
  userId: string;
  companyId: string;
  ip?: string | null;
}) {
  const ip = input.ip?.trim() || "unknown";
  return `coupon-validate:${input.userId}:${input.companyId}:${ip}`;
}
