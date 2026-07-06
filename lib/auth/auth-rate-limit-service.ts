import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/lib/prisma";

/**
 * Login ve forgot-password endpoint'leri için DB-backed brute-force koruması.
 * In-memory Map KULLANILMADI — process restart / PM2 cluster / çoklu instance
 * senaryolarında güvenlik kaynağı olamayacağı önceki bir fazda (employee
 * payment idempotency) netleşmişti; aynı ders burada da uygulandı.
 *
 * Politika: pencere içinde MAX_ATTEMPTS başarısız denemeden sonra kilit;
 * kilit süresi her tekrar denemede katlanarak artar (exponential backoff),
 * ATTEMPT_WINDOW_MS içinde başarılı giriş sayaç/kilidi sıfırlar.
 *
 * scope alanı firmadan TAMAMEN bağımsızdır — login/forgot-password henüz
 * bir firma session'ı kurulmadan (hatta hiç firması olmayan/yeni kayıt
 * kullanıcılar için) çalışır; bu yüzden şema alanları arasında firma
 * kimliğine dair hiçbir sütun BULUNMAZ.
 */

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 dk pencere
const MAX_ATTEMPTS_BEFORE_LOCK = 5;
const BASE_LOCK_MS = 60 * 1000; // ilk kilit: 1 dk
const MAX_LOCK_MS = 30 * 60 * 1000; // üst sınır: 30 dk
// Kilidi çoktan bitmiş ve son bir gündür hiç yeni denemesi olmayan kayıtlar
// fırsatçı olarak temizlenir — tabloyu sınırsız büyütmez, ayrı bir cron
// job/queue gerektirmez (bkz. lib/supplier-create-idempotency.ts'deki aynı
// fırsatçı temizlik deseni).
const STALE_RECORD_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_PROBABILITY = 0.02; // her ~50 çağrıda bir tetiklenir

export type AuthRateLimitScope = "login" | "forgot-password" | "contact";

export type RateLimitCheckResult =
  | { limited: false }
  | { limited: true; retryAfterSeconds: number };

/**
 * Kimlik (e-posta veya IP) ham hâliyle DB'de SAKLANMAZ — normalize edilip
 * sha256 hash'i saklanır. Bu hem PII/IP'nin düz metin tutulmasını önler hem
 * de IPv6 büyük/küçük harf ve boşluk farklarını normalize eder.
 */
function buildKey(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

async function opportunisticCleanup() {
  if (Math.random() > CLEANUP_PROBABILITY) return;
  const cutoff = new Date(Date.now() - STALE_RECORD_TTL_MS);
  try {
    await db.authRateLimit.deleteMany({
      where: {
        lastAttemptAt: { lt: cutoff },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
    });
  } catch (error) {
    // Temizlik başarısız olsa da rate-limit akışını bloklamamalı.
    console.error("AUTH_RATE_LIMIT_CLEANUP_FAILED", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

/** İstek işlenmeden ÖNCE çağrılır — kilitliyse false dönmeden reddet. */
export async function checkAuthRateLimit(
  scope: AuthRateLimitScope,
  identifier: string
): Promise<RateLimitCheckResult> {
  const key = buildKey(identifier);
  const record = await db.authRateLimit.findUnique({
    where: { scope_key: { scope, key } },
  });

  if (!record) return { limited: false };

  const now = Date.now();

  if (record.lockedUntil && record.lockedUntil.getTime() > now) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((record.lockedUntil.getTime() - now) / 1000),
    };
  }

  return { limited: false };
}

function computeLockMs(attemptCountAfterThreshold: number) {
  // 5. denemede 1dk, 6.'da 2dk, 7.'de 4dk ... üst sınır 30dk.
  const exponent = Math.max(0, attemptCountAfterThreshold - MAX_ATTEMPTS_BEFORE_LOCK);
  const ms = BASE_LOCK_MS * Math.pow(2, exponent);
  return Math.min(ms, MAX_LOCK_MS);
}

/** Başarısız deneme sonrası çağrılır — sayaç artar, eşik aşılırsa kilitler. */
export async function registerAuthFailure(
  scope: AuthRateLimitScope,
  identifier: string
): Promise<RateLimitCheckResult> {
  void opportunisticCleanup();

  const key = buildKey(identifier);
  const now = new Date();

  const existing = await db.authRateLimit.findUnique({
    where: { scope_key: { scope, key } },
  });

  const windowExpired =
    existing && now.getTime() - existing.windowStartAt.getTime() > ATTEMPT_WINDOW_MS;

  const nextCount = !existing || windowExpired ? 1 : existing.attemptCount + 1;
  const windowStartAt = !existing || windowExpired ? now : existing.windowStartAt;

  let lockedUntil: Date | null = null;
  if (nextCount >= MAX_ATTEMPTS_BEFORE_LOCK) {
    lockedUntil = new Date(now.getTime() + computeLockMs(nextCount));
  }

  await db.authRateLimit.upsert({
    where: { scope_key: { scope, key } },
    create: {
      scope,
      key,
      attemptCount: nextCount,
      windowStartAt,
      lockedUntil,
      lastAttemptAt: now,
    },
    update: {
      attemptCount: nextCount,
      windowStartAt,
      lockedUntil,
      lastAttemptAt: now,
    },
  });

  if (lockedUntil) {
    console.error("AUTH_RATE_LIMIT_LOCKED", {
      scope,
      attemptCount: nextCount,
      lockedUntilIso: lockedUntil.toISOString(),
    });
    return {
      limited: true,
      retryAfterSeconds: Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  return { limited: false };
}

/** Başarılı giriş/işlem sonrası çağrılır — sayaç ve kilit sıfırlanır. */
export async function clearAuthRateLimit(scope: AuthRateLimitScope, identifier: string) {
  const key = buildKey(identifier);
  await db.authRateLimit.deleteMany({ where: { scope, key } });
}
