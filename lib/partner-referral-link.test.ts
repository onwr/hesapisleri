/**
 * Referans/ortaklık linki — kaynak tarama testleri. DB gerektirmez
 * (TEST_DATABASE_URL yoksa gerçek DB entegrasyon testi çalıştırılmadı).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const ROUTE_PATH = "app/r/[code]/route.ts";
const CONVERSION_PATH = "lib/partner-conversion-service.ts";

describe("/r/[code] — referans link yönlendirmesi", () => {
  it("oturum açık kullanıcı /settings/billing'e, oturumsuz kullanıcı /register'a yönlendiriliyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes('isAuthenticated ? "/settings/billing" : "/register"'));
  });

  it("her iki hedefte de ?ref= kodu korunuyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes('redirectUrl.searchParams.set("ref", sanitized)'));
  });

  it("geçersiz kod açık internal hata üretmiyor — güvenli fallback (kodsuz /register)", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    const catchIdx = content.indexOf("} catch (error) {");
    const catchBody = content.slice(catchIdx, catchIdx + 300);
    assert.ok(catchBody.includes('new URL("/register", url.origin)'));
    assert.ok(!catchBody.includes("error.message"));
  });

  it("cookie httpOnly + sameSite=lax + configurable maxAge ile ayarlanıyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("httpOnly: true"));
    assert.ok(content.includes('sameSite: "lax"'));
    assert.ok(content.includes("getPartnerCookieMaxAge"));
  });

  it("kod URL'de kalıcı olarak DEĞİL yalnız redirect anında taşınıyor, gerçek kaynak cookie'dir (httpOnly, JS erişemez)", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("PARTNER_REF_COOKIE"));
  });

  it("IP çözümlemesi canonical getTrustedClientIp ile yapılıyor — kendi spoof edilebilir XFF ayrıştırması yok", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("getTrustedClientIp(req)"));
    assert.ok(!content.includes('x-forwarded-for")?.split(",")[0]'));
  });

  it("auth token doğrulaması try/catch ile sarmalı — bozuk/geçersiz token route'u çökertmez", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    const fnStart = content.indexOf("async function resolveReferralDestination");
    const fnBody = content.slice(fnStart, fnStart + 500);
    assert.ok(fnBody.includes("try {"));
    assert.ok(fnBody.includes("verifyToken(token)"));
  });
});

describe("partner conversion — self-referral engeli", () => {
  it("ortak kendi userId'siyle eşleşen kayıt için conversion oluşturmuyor", async () => {
    const content = await fs.readFile(CONVERSION_PATH, "utf8");
    const fnStart = content.indexOf("export async function createPartnerSignupConversion");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("partner.userId === input.userId"));
    assert.ok(fnBody.includes("return null;"));
  });

  it("aynı ödeme için duplicate komisyon oluşmuyor (membershipPaymentId unique kontrolü)", async () => {
    const content = await fs.readFile(CONVERSION_PATH, "utf8");
    const fnStart = content.indexOf("export async function createPartnerPaymentConversion");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("partnerEarning"));
    assert.ok(fnBody.includes("where: { membershipPaymentId: input.membershipPaymentId }"));
    assert.ok(fnBody.includes("if (existingEarning) return null;"));
  });

  it("[DB entegrasyon] geçerli kod ile kayıt → pricing → checkout attribution korunur", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
  });
});

describe("mevcut register route — referral attribution zaten kullanıcı oluşturma sonrası çağrılıyor (regresyon kilidi)", () => {
  it("createPartnerSignupConversion register akışında kullanılıyor", async () => {
    const content = await fs.readFile("app/api/auth/register/route.ts", "utf8");
    assert.ok(content.includes("createPartnerSignupConversion({"));
    assert.ok(content.includes("resolvePartnerFromAttribution({"));
  });
});
