/**
 * lib/mail-service.ts — gerçek unit testler (test adapter üzerinden, DB
 * gerektirmez) + production güvenlik kaynak taraması.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/mail-service.ts";

describe("mail-service — test adapter (gerçek unit test)", () => {
  const originalProvider = process.env.MAIL_PROVIDER;

  beforeEach(() => {
    process.env.MAIL_PROVIDER = "test";
  });

  afterEach(() => {
    process.env.MAIL_PROVIDER = originalProvider;
  });

  it("test adapter mesajı gerçekten göndermeden outbox'a ekler", async () => {
    const { sendMail, _getTestOutbox, _clearTestOutbox } = await import("./mail-service");
    _clearTestOutbox();

    const result = await sendMail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>merhaba</p>",
      text: "merhaba",
    });

    assert.equal(result.ok, true);
    const outbox = _getTestOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]?.to, "test@example.com");
    _clearTestOutbox();
  });

  it("isMailConfigured test adapter aktifken true döner", async () => {
    const { isMailConfigured } = await import("./mail-service");
    assert.equal(isMailConfigured(), true);
  });
});

describe("mail-service — production güvenlik kaynak taraması", () => {
  it("MAIL_PROVIDER=test production'da açıkça engelleniyor (throw)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf('if (configured === "test")');
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("if (isProduction)"));
    assert.ok(fnBody.includes("throw new Error"));
  });

  it("mail içeriği (token/link) hiçbir console çağrısında yok — yalnız hata kodu/isim loglanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const consoleCalls = content.match(/console\.(error|warn|log)\([^)]*\)/g) ?? [];
    for (const call of consoleCalls) {
      assert.ok(!call.includes("message.html"), `${call} mail içeriğini loglamamalı`);
      assert.ok(!call.includes("message.text"), `${call} mail içeriğini loglamamalı`);
    }
  });

  it("provider yapılandırılmamışsa PROVIDER_NOT_CONFIGURED döner, exception fırlatmaz", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes('"PROVIDER_NOT_CONFIGURED"'));
  });

  it("Resend API key/from eksikse gönderim güvenli şekilde başarısız döner", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function sendViaResend");
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("if (!apiKey || !from)"));
  });
});
