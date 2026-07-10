/**
 * QA Faz 5C — güvenlik doğrulaması, UX kapanışı ve regresyon
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  getAuthCookieOptions,
  getBrowserSessionAuthCookieOptions,
} from "@/lib/auth/auth-cookie";
import {
  isBearerOnlyApiPath,
  isMutationOriginExemptPath,
  shouldRejectUntrustedMutation,
} from "@/lib/api-origin-guard";
import { PRIVACY_POLICY_PATH } from "@/lib/legal/privacy-policy";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("Faz 5C — CSRF / origin guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  it("proxy mutation isteklerinde origin doğrulaması uygular", () => {
    const proxy = readSrc("proxy.ts");
    assert.match(proxy, /shouldRejectUntrustedMutation/);
    assert.match(proxy, /createCsrfOriginRejectedResponse/);
  });

  it("güvenilir same-origin POST geçer", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/companies/switch",
        origin: "https://hesapisleri.com",
        referer: null,
        authorization: null,
      }),
      false
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("kötü Origin reddedilir", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/products/bulk",
        origin: "https://evil.example",
        referer: null,
        authorization: null,
      }),
      true
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("kötü Referer reddedilir", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/expenses",
        origin: null,
        referer: "https://evil.example/phish",
        authorization: null,
      }),
      true
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("Origin ve Referer yokken browser-session mutation reddedilir", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "DELETE",
        pathname: "/api/invoices/abc",
        origin: null,
        referer: null,
        authorization: null,
      }),
      true
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("Sipay return/cancel, webhook, cron istisna; mobile bearer-only", () => {
    assert.equal(isMutationOriginExemptPath("/api/billing/sipay/return"), true);
    assert.equal(isMutationOriginExemptPath("/api/billing/sipay/cancel"), true);
    assert.equal(isMutationOriginExemptPath("/api/webhooks/sipay"), true);
    assert.equal(isMutationOriginExemptPath("/api/cron/subscription-renew"), true);
    assert.equal(isBearerOnlyApiPath("/api/mobile/pos/sales"), true);
    assert.equal(isMutationOriginExemptPath("/api/mobile/pos/sales"), false);
  });

  it("mobile bearer-only route origin olmadan geçer", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/mobile/catalog/sync",
        origin: null,
        referer: null,
        authorization: "Bearer mobile-token",
      }),
      false
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("sahte Bearer web mutation reddedilir", () => {
    setNodeEnv("production");
    process.env.APP_URL = "https://hesapisleri.com";

    assert.equal(
      shouldRejectUntrustedMutation({
        method: "POST",
        pathname: "/api/expenses",
        origin: "https://evil.example",
        referer: null,
        authorization: "Bearer fake",
      }),
      true
    );

    setNodeEnv(originalNodeEnv ?? "test");
  });

  it("production fallback CSRF secret yok", () => {
    const guard = readSrc("lib/api-origin-guard.ts");
    assert.ok(!guard.includes("csrf-secret"));
    assert.ok(!guard.includes("CSRF_SECRET"));
  });
});

describe("Faz 5C — Beni Hatırla", () => {
  it("login API remember alanını kabul eder", () => {
    const login = readSrc("app/api/auth/login/route.ts");
    assert.match(login, /remember:\s*z\.boolean/);
    assert.match(login, /attachAuthCookie\([\s\S]*remember/);
  });

  it("login form remember payload gönderir", () => {
    const form = readSrc("components/login/login-form.tsx");
    assert.match(form, /JSON\.stringify\(\{ email, password, remember \}\)/);
    assert.match(form, /htmlFor="remember"/);
    assert.match(form, /aria-describedby="remember-help"/);
    assert.match(form, /PRIVACY_POLICY_PATH/);
    assert.doesNotMatch(form, /rounded-md border-slate-300 data-checked/);
  });

  it("unchecked session cookie maxAge içermez", () => {
    const opts = getBrowserSessionAuthCookieOptions();
    assert.equal("maxAge" in opts, false);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, "lax");
  });

  it("checked remember cookie maxAge içerir", () => {
    const opts = getAuthCookieOptions(7);
    assert.equal(opts.maxAge, 7 * 60 * 60 * 24);
  });
});

describe("Faz 5C — Gizlilik ve KVKK ayrımı", () => {
  it("gizlilik politikası ayrı route", () => {
    assert.equal(PRIVACY_POLICY_PATH, "/privacy");
    const page = readSrc("app/privacy/page.tsx");
    assert.match(page, /PrivacyPolicyContent/);
  });

  it("footer ve kayıt gizlilik linkleri /privacy'e gider", () => {
    const footer = readSrc("components/marketing/marketing-footer.tsx");
    assert.match(footer, /PRIVACY_POLICY_PATH/);
    assert.match(footer, /Gizlilik Politikası/);

    const register = readSrc("components/register/register-form.tsx");
    assert.match(register, /PRIVACY_POLICY_PATH/);
    assert.match(register, /KVKK_AYDINLATMA_PATH/);
    assert.match(register, /kvkkInformed/);

    const schema = readSrc("lib/auth/register-schema.ts");
    assert.match(schema, /kvkkInformed:\s*z\.literal\(true/);
  });

  it("gizlilik içeriği KVKK aydınlatma ile birleştirilmemiş", () => {
    const content = readSrc("components/legal/privacy-policy-content.tsx");
    assert.match(content, /Gizlilik Politikası/);
    assert.match(content, /KVKK_AYDINLATMA_PATH/);
    assert.doesNotMatch(content, /KVKK Aydınlatma Metni ve Gizlilik Politikası/i);
  });
});

describe("Faz 5C — skip navigation ve erişilebilirlik", () => {
  it("root layout skip link içerir", () => {
    const layout = readSrc("app/layout.tsx");
    assert.match(layout, /SkipToContentLink/);
    const skip = readSrc("components/layout/skip-to-content-link.tsx");
    assert.match(skip, /İçeriğe geç/);
    assert.match(skip, /#main-content/);
  });

  it("ana layout'larda main-content id tek", () => {
    for (const file of [
      "components/layout/app-shell-client.tsx",
      "components/auth/auth-shell.tsx",
      "app/page.tsx",
      "components/layout/not-found-panels.tsx",
    ]) {
      const src = readSrc(file);
      const matches = src.match(/id="main-content"/g) ?? [];
      assert.equal(matches.length, 1, `${file} should have exactly one main-content id`);
    }
  });
});

describe("Faz 5C — güvenlik başlıkları", () => {
  it("production CSP unsafe-eval içermez", () => {
    const headers = readSrc("lib/security-headers.ts");
    const productionBranch = headers.match(
      /isProduction\s*\?\s*("script-src[^"]+")/
    )?.[1];
    assert.ok(productionBranch);
    assert.ok(!productionBranch!.includes("unsafe-eval"));
  });

  it("Sipay için gereksiz form-action kısıtı yok", () => {
    const headers = readSrc("lib/security-headers.ts");
    const branches = headers.match(
      /paytrEnabled \? ("form-action[^"]+") : ("form-action[^"]+)"/
    );
    assert.ok(branches);
    assert.doesNotMatch(branches![1], /sipay/i);
    assert.doesNotMatch(branches![2], /sipay/i);
  });
});

describe("Faz 5C — Türkçe hata mesajları", () => {
  it("api-user-error canonical mesajlar mevcut", () => {
    const src = readSrc("lib/api-user-error.ts");
    assert.match(src, /VALIDATION_ERROR/);
    assert.match(src, /Bu alan zorunludur/);
    assert.match(src, /Geçerli bir e-posta adresi girin/);
  });

  it("kayıt formu noValidate ve HTML required kullanmaz", () => {
    const register = readSrc("components/register/register-form.tsx");
    assert.match(register, /noValidate/);
    assert.doesNotMatch(register, /\brequired\b/);
  });
});
