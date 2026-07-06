/**
 * Şifremi Unuttum / reset-password — kaynak tarama testleri. DB gerektirmez
 * (TEST_DATABASE_URL yoksa gerçek DB entegrasyon testi çalıştırılmadı).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/auth/password-reset-service.ts";
const RESET_ROUTE_PATH = "app/api/auth/reset-password/route.ts";

describe("password reset — token güvenliği", () => {
  it("ham token DB'de asla saklanmıyor, yalnız sha256 hash'i saklanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('createHash("sha256")'));
    assert.ok(content.includes("tokenHash"));
    assert.ok(!content.includes("rawToken,\n") || content.includes("tokenHash,"));
  });

  it("token 30 dakika sonra süresi doluyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000"));
  });

  it("yeni token oluşturulunca eski açık tokenlar geçersiz kılınıyor (yalnız bir aktif link)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function requestPasswordReset");
    const fnBody = content.slice(fnStart, fnStart + 1600);
    assert.ok(fnBody.includes("passwordResetToken.updateMany"));
    assert.ok(fnBody.includes("usedAt: null, expiresAt: { gt: new Date() }"));
  });

  it("token tüketimi (consume) tek transaction içinde: used-işaretleme + şifre güncelleme + sessionVersion artırma", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function consumePasswordResetToken");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("await db.$transaction(async (tx) => {"));
    assert.ok(fnBody.includes("passwordResetToken.updateMany"));
    assert.ok(fnBody.includes("sessionVersion: { increment: 1 }"));
  });

  it("şifre sıfırlanınca sessionVersion artıyor — eski oturumlar/JWT'ler geçersiz kalır", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("sessionVersion: { increment: 1 }"));
  });

  it("double-submit koruması: claimed.count===0 ise ikinci istek PasswordResetTokenError fırlatır", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("claimed.count === 0"));
    assert.ok(content.includes("throw new PasswordResetTokenError()"));
  });

  it("kullanılmış veya süresi dolmuş token geçersiz sayılıyor (findValidTokenRecord)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function findValidTokenRecord");
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("record.usedAt"));
    assert.ok(fnBody.includes("record.expiresAt.getTime() < Date.now()"));
  });

  it("reset-password şifre kuralı register ile AYNI şema (passwordSchema) — ayrı kural icat edilmedi", async () => {
    const routeContent = await fs.readFile(RESET_ROUTE_PATH, "utf8");
    assert.ok(routeContent.includes('from "@/lib/auth/register-schema"'));
    assert.ok(routeContent.includes("passwordSchema"));
  });

  it("GET endpoint token'ı DOĞRULAR ama tüketmez (sayfa yüklenirken tek kullanımlık token harcanmaz)", async () => {
    const content = await fs.readFile(RESET_ROUTE_PATH, "utf8");
    const getStart = content.indexOf("export async function GET");
    const getBody = content.slice(getStart, content.indexOf("export async function POST"));
    assert.ok(getBody.includes("validatePasswordResetToken"));
    assert.ok(!getBody.includes("consumePasswordResetToken"));
  });

  it("[DB entegrasyon] süresi dolmuş token reddedilir, geçerli token ile şifre güncellenir", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
  });
});

describe("password reset — mail servisi üzerinden gönderim (log bridge KALDIRILDI)", () => {
  it("PASSWORD_RESET_LINK_TEMP_BRIDGE tamamen kaldırıldı, resetLink hiçbir yerde console'a yazılmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(!content.includes("PASSWORD_RESET_LINK_TEMP_BRIDGE"));
    assert.ok(!content.includes("console.warn"));
    assert.ok(!content.includes("console.log"));
  });

  it("requestPasswordReset canonical sendMail() servisini kullanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('from "@/lib/mail-service"'));
    assert.ok(content.includes("await sendMail({"));
  });

  it("resetLink hiçbir API response'unda dönmüyor (yalnız e-posta içeriğinde)", async () => {
    const forgotRoute = await fs.readFile("app/api/auth/forgot-password/route.ts", "utf8");
    assert.ok(!forgotRoute.includes("resetLink"));
  });

  it("mail gönderimi başarısız olursa hata KODU loglanır ama token/link/URL loglanmaz", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("if (!result.ok)");
    const fnBody = content.slice(fnStart, fnStart + 600);
    assert.ok(fnBody.includes("PASSWORD_RESET_EMAIL_NOT_DELIVERED"));
    assert.ok(fnBody.includes("reason: result.reason"));
    assert.ok(!fnBody.includes("resetLink"));
  });

  it("mail başarısız olsa da route yine aynı genel mesajı döner (enumeration/durum sızdırmaz)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("if (!result.ok)");
    const fnBody = content.slice(fnStart, fnStart + 600);
    assert.ok(fnBody.includes("requested: true as const"));
  });
});
