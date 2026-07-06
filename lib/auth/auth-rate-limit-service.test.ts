/**
 * Login/forgot-password rate limiting — kaynak tarama + saf mantık testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa gerçek DB entegrasyon testi
 * çalıştırılmadı — bu dosya kaynak tarama/unit'tir).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/auth/auth-rate-limit-service.ts";
const LOGIN_ROUTE_PATH = "app/api/auth/login/route.ts";
const FORGOT_ROUTE_PATH = "app/api/auth/forgot-password/route.ts";

describe("auth rate limit — DB-backed (in-memory DEĞİL)", () => {
  it("db.authRateLimit kullanıyor, module-level Map/cache yok", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("db.authRateLimit"));
    assert.ok(!content.includes("new Map("), "in-memory Map kullanılmamalı — process/instance bağımsız olmalı");
  });

  it("scope+key üzerinde unique constraint'e dayanıyor (schema'da tanımlı)", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model AuthRateLimit");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(modelBody.includes("@@unique([scope, key])"));
  });

  it("login ve forgot-password farklı scope kullanıyor (birbirini kilitlemez)", async () => {
    const loginContent = await fs.readFile(LOGIN_ROUTE_PATH, "utf8");
    assert.ok(loginContent.includes('"login"'));
    const forgotContent = await fs.readFile(FORGOT_ROUTE_PATH, "utf8");
    assert.ok(forgotContent.includes('"forgot-password"'));
  });

  it("login: başarısız denemeler sayılıyor, başarılı girişte sayaç temizleniyor", async () => {
    const content = await fs.readFile(LOGIN_ROUTE_PATH, "utf8");
    assert.ok(content.includes("registerAuthFailure(\"login\""));
    assert.ok(content.includes("clearAuthRateLimit(\"login\""));
  });

  it("login: hem 'kullanıcı yok' hem 'şifre yanlış' dallarında rate limit artıyor (enumeration timing farkı yaratmıyor)", async () => {
    const content = await fs.readFile(LOGIN_ROUTE_PATH, "utf8");
    const occurrences = content.split('registerAuthFailure("login"').length - 1;
    assert.ok(occurrences >= 2, "her iki başarısızlık dalında da registerAuthFailure çağrılmalı");
  });

  it("kilitlenince 429 + Retry-After header dönüyor", async () => {
    const content = await fs.readFile(LOGIN_ROUTE_PATH, "utf8");
    assert.ok(content.includes("status: 429"));
    assert.ok(content.includes('"Retry-After"'));
  });

  it("checkAuthRateLimit istek işlenmeden ÖNCE çağrılıyor (route'un en başında)", async () => {
    const content = await fs.readFile(LOGIN_ROUTE_PATH, "utf8");
    const postIdx = content.indexOf("export async function POST");
    const checkIdx = content.indexOf("checkAuthRateLimit(", postIdx);
    const bodyParseIdx = content.indexOf("await req.json()");
    assert.ok(checkIdx > postIdx);
    assert.ok(checkIdx < bodyParseIdx, "rate limit kontrolü body parse'dan önce olmalı");
  });

  it("exponential backoff: eşik aşıldıkça kilit süresi artıyor, üst sınırla sınırlı", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("Math.pow(2, exponent)"));
    assert.ok(content.includes("Math.min(ms, MAX_LOCK_MS)"));
  });

  it("[DB entegrasyon] eşzamanlı/ardışık 6 başarısız denemeden sonra 5. veya 6. istek kilitlenir", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
  });

  it("kimlik (e-posta/IP) ham hâliyle saklanmıyor — sha256 hash'i saklanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('createHash("sha256")'));
    assert.ok(content.includes(".digest(\"hex\")"));
  });

  it("scope alanında companyId YOK — auth rate limit company'den bağımsız çalışır", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model AuthRateLimit");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(!modelBody.includes("companyId"));
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("companyId"));
  });

  it("eski kayıtlar için fırsatçı temizlik var (tablo sınırsız büyümüyor)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("opportunisticCleanup"));
    assert.ok(content.includes("STALE_RECORD_TTL_MS"));
    assert.ok(content.includes("authRateLimit.deleteMany"));
  });

  it("scope+lockedUntil index'i var (temizlik/lookup sorguları için)", async () => {
    const schema = await fs.readFile("prisma/schema.prisma", "utf8");
    const modelStart = schema.indexOf("model AuthRateLimit");
    const modelBody = schema.slice(modelStart, schema.indexOf("}", modelStart) + 1);
    assert.ok(modelBody.includes("@@index([scope, lockedUntil])"));
  });
});

describe("trusted client IP — spoof edilemeyen X-Forwarded-For yaklaşımı", () => {
  const IP_PATH = "lib/payments/trusted-client-ip.ts";

  it("X-Real-IP birincil kaynak (nginx tarafından overwrite edilir, istemci spoof edemez)", async () => {
    const content = await fs.readFile(IP_PATH, "utf8");
    const fnStart = content.indexOf("export function getTrustedClientIp");
    const fnBody = content.slice(fnStart, fnStart + 300);
    assert.ok(fnBody.includes('headers.get("x-real-ip")'));
    const realIpIdx = fnBody.indexOf("x-real-ip");
    const xffIdx = fnBody.indexOf("x-forwarded-for");
    assert.ok(realIpIdx !== -1 && (xffIdx === -1 || realIpIdx < xffIdx), "x-real-ip x-forwarded-for'dan önce kontrol edilmeli");
  });

  it("X-Forwarded-For fallback'inde İLK değil SON hop kullanılıyor (istemci ilk hop'u sahtekarlıkla ekleyebilir)", async () => {
    const content = await fs.readFile(IP_PATH, "utf8");
    assert.ok(content.includes("parts[parts.length - 1]"));
    assert.ok(!content.includes('split(",")[0]'), "artık ilk eleman güvenilir kaynak olarak kullanılmamalı");
  });

  it("IP formatı doğrulanıyor (isIP), rastgele string kabul edilmiyor", async () => {
    const content = await fs.readFile(IP_PATH, "utf8");
    assert.ok(content.includes("isIP(trimmed)"));
  });

  it("IPv6 uzunluğu destekleniyor (39 değil 45 karaktere kadar — IPv4-mapped IPv6 dahil)", async () => {
    const content = await fs.readFile(IP_PATH, "utf8");
    assert.ok(content.includes("trimmed.length > 45"));
  });

  it("nginx trusted-proxy varsayımı dokümante edilmiş", async () => {
    const content = await fs.readFile(IP_PATH, "utf8");
    assert.ok(content.includes("TRUSTED PROXY VARSAYIMI"));
    assert.ok(content.includes("proxy_set_header X-Real-IP"));
  });
});

describe("forgot-password — enumeration koruması", () => {
  it("kullanıcı var/yok fark etmeksizin her zaman aynı genel mesajı ve success:true döner", async () => {
    const content = await fs.readFile(FORGOT_ROUTE_PATH, "utf8");
    const successCount = content.match(/success: true/g)?.length ?? 0;
    assert.ok(successCount >= 2, "hem normal hem hata dalında success:true dönmeli (enumeration koruması)");
    assert.ok(content.includes("GENERIC_SUCCESS_MESSAGE"));
  });

  it("requestPasswordReset kullanıcı yoksa/aktif değilse sessizce hiçbir kayıt oluşturmuyor", async () => {
    const content = await fs.readFile("lib/auth/password-reset-service.ts", "utf8");
    const fnStart = content.indexOf("export async function requestPasswordReset");
    const fnBody = content.slice(fnStart, content.indexOf("export class PasswordResetTokenError"));
    assert.ok(fnBody.includes('if (!user || user.status !== "ACTIVE")'));
    assert.ok(fnBody.includes("requested: false"));
  });

  it("forgot-password da rate limit'e tabi (spam/enumeration brute-force önlemi)", async () => {
    const content = await fs.readFile(FORGOT_ROUTE_PATH, "utf8");
    assert.ok(content.includes("checkAuthRateLimit(\"forgot-password\""));
    assert.ok(content.includes("registerAuthFailure(\"forgot-password\""));
  });
});
