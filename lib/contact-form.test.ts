/**
 * İletişim formu — gerçek unit testler (schema, DB gerektirmez) + kaynak
 * tarama (route güvenlik davranışı).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";
import { contactFormSchema } from "./contact-schema";

const ROUTE_PATH = "app/api/contact/route.ts";
const SECTION_PATH = "components/marketing/contact-section.tsx";

const validPayload = {
  name: "Ahmet Yılmaz",
  email: "ahmet@example.com",
  subject: "Fiyatlandırma sorusu",
  message: "Merhaba, paketleriniz hakkında bilgi almak istiyorum.",
  consent: true as const,
  website: "",
};

describe("contactFormSchema — gerçek unit testler", () => {
  it("geçerli payload kabul ediliyor", () => {
    const result = contactFormSchema.safeParse(validPayload);
    assert.equal(result.success, true);
  });

  it("boş ad reddediliyor", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, name: "" });
    assert.equal(result.success, false);
  });

  it("geçersiz e-posta reddediliyor", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, email: "gecersiz" });
    assert.equal(result.success, false);
  });

  it("kısa mesaj (10 karakterden az) reddediliyor", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, message: "kısa" });
    assert.equal(result.success, false);
  });

  it("KVKK onayı false ise reddediliyor", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, consent: false });
    assert.equal(result.success, false);
  });

  it("mesaj/konu alanında HTML tag reddediliyor", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      subject: "<script>alert(1)</script>",
    });
    assert.equal(result.success, false);
  });

  it("honeypot (website) doluysa şema YİNE DE geçerli sayılır — 400 dönüp botu uyarmamak için reddetme kararı route katmanında verilir", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, website: "spam" });
    assert.equal(result.success, true);
  });
});

describe("contact route — güvenlik kaynak taraması", () => {
  it("mail yapılandırılmamışsa route 503 döner, sessizce 'başarılı' göstermez", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("isMailConfigured()"));
    assert.ok(content.includes("status: 503"));
  });

  it("hem IP hem e-posta bazlı ayrı rate limit uygulanıyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes('checkAuthRateLimit("contact", clientIp)'));
    assert.ok(content.includes('checkAuthRateLimit("contact", parsed.data.email)'));
  });

  it("honeypot doluysa mail gönderilmeden genel başarı mesajı dönülüyor (bot bilgilendirilmiyor)", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    const idx = content.indexOf("if (parsed.data.website)");
    const body = content.slice(idx, idx + 200);
    assert.ok(body.includes("success: true"));
    assert.ok(!body.includes("sendMail"));
  });

  it("honeypot kontrolü ÖLÜ KOD DEĞİL — schema honeypot dolu olsa da safeParse'ı geçirir (route'taki if bloğuna gerçekten ulaşılır)", () => {
    const result = contactFormSchema.safeParse({ ...validPayload, website: "http://spam.example" });
    assert.equal(result.success, true, "schema honeypot'u reddederse route'taki honeypot kontrolüne asla ulaşılmaz");
  });

  it("kullanıcı girdisi HTML mail gövdesine escapelenerek konuluyor (XSS'e karşı)", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("function escapeHtml"));
    assert.ok(content.includes("escapeHtml(parsed.data.name)"));
    assert.ok(content.includes("escapeHtml(parsed.data.message)"));
  });

  it("gönderim başarısız olursa iç hata detayı sızdırılmıyor, GENERIC_ERROR_MESSAGE dönülüyor", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("GENERIC_ERROR_MESSAGE"));
    const catchIdx = content.indexOf("} catch (error) {");
    const catchBody = content.slice(catchIdx, catchIdx + 300);
    assert.ok(!catchBody.includes("error.message,"), "hata mesajı response'a konulmamalı");
  });

  it("reply-to kullanıcının e-postası, gönderen (from) her zaman platform MAIL_FROM (spoofing önlenir)", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("replyTo: parsed.data.email"));
    assert.ok(!content.includes("from: parsed.data.email"));
  });
});

describe("contact section — mail altyapısı yoksa form gösterilmiyor", () => {
  it("isMailConfigured false ise mailto fallback gösteriliyor, form render edilmiyor", async () => {
    const content = await fs.readFile(SECTION_PATH, "utf8");
    assert.ok(content.includes("mailReady ? ("));
    assert.ok(content.includes("<ContactForm />"));
    assert.ok(content.includes("mailto:"));
  });
});
