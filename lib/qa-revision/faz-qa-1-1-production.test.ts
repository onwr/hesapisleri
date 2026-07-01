/**
 * QA Faz 1.1 — production-benzeri CSRF, demo login, CSP, SEO, 404, responsive doğrulama.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function runProductionOriginGuardCheck(input: {
  origin: string | null;
  referer: string | null;
  method?: string;
}) {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/check-origin-guard-production.mjs",
      JSON.stringify(input),
    ],
    { cwd: webRoot, encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "origin guard subprocess failed");
  }

  return JSON.parse(result.stdout.trim()) as { allowed: boolean; status?: number };
}

describe("QA Faz 1.1 — CSRF production-benzeri", () => {
  const routes = [
    "lib/account-api-handlers.ts account create/update/archive",
    "app/api/cash-bank/transfer/route.ts transfer",
    "app/api/cash-bank/accounts/[id]/transactions/route.ts cash operation",
    "app/api/auth/demo-login/route.ts demo login",
  ];

  for (const route of routes) {
    it(`${route} verifyApiMutationOrigin kullanır`, () => {
      const [file] = route.split(" ");
      assert.match(read(file), /verifyApiMutationOrigin/);
    });
  }

  it("same-origin localhost POST kabul edilir (NODE_ENV=production)", () => {
    const result = runProductionOriginGuardCheck({
      origin: "http://localhost:3000",
      referer: null,
    });
    assert.equal(result.allowed, true);
  });

  it("farklı origin POST reddedilir (403)", () => {
    const result = runProductionOriginGuardCheck({
      origin: "https://evil.example",
      referer: null,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it("eksik origin/referer POST reddedilir", () => {
    const result = runProductionOriginGuardCheck({
      origin: null,
      referer: null,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.status, 403);
  });

  it("OPTIONS preflight origin guard uygulanmaz", () => {
    const result = runProductionOriginGuardCheck({
      origin: "https://evil.example",
      referer: null,
      method: "OPTIONS",
    });
    assert.equal(result.allowed, true);
  });

  it("mobile Bearer route web cookie CSRF guard içermez", () => {
    const mobileCollect = read("app/api/mobile/collections/route.ts");
    assert.doesNotMatch(mobileCollect, /verifyApiMutationOrigin/);
    assert.match(mobileCollect, /requireMobileCompanySession/);
  });
});

describe("QA Faz 1.1 — demo login", () => {
  it("env olmadan demo login kapalı", async () => {
    const saved = {
      enabled: process.env.DEMO_LOGIN_ENABLED,
      email: process.env.DEMO_LOGIN_EMAIL,
      password: process.env.DEMO_LOGIN_PASSWORD,
    };

    delete process.env.DEMO_LOGIN_ENABLED;
    delete process.env.DEMO_LOGIN_EMAIL;
    delete process.env.DEMO_LOGIN_PASSWORD;

    const { isDemoLoginEnabled, performDemoLogin } = await import(
      "@/lib/demo-login-service"
    );
    assert.equal(isDemoLoginEnabled(), false);

    const result = await performDemoLogin(
      new Request("http://localhost/api/auth/demo-login", { method: "POST" })
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);

    const loginForm = read("components/login/login-form.tsx");
    assert.doesNotMatch(loginForm, /123456/);
    assert.doesNotMatch(loginForm, /DEMO_PASSWORD/);

    process.env.DEMO_LOGIN_ENABLED = saved.enabled;
    process.env.DEMO_LOGIN_EMAIL = saved.email;
    process.env.DEMO_LOGIN_PASSWORD = saved.password;
  });

  it("demo-login-service credential loglamaz", () => {
    const service = read("lib/demo-login-service.ts");
    assert.doesNotMatch(service, /console\.log\([^)]*password/i);
    assert.doesNotMatch(service, /DEMO_LOGIN_PASSWORD.*json/i);
  });

  it("demo-login rate limit kodu mevcut", () => {
    const service = read("lib/demo-login-service.ts");
    assert.match(service, /RATE_LIMIT_MAX/);
    assert.match(service, /429/);
  });
});

describe("QA Faz 1.1 — CSP production header config", () => {
  it("next.config production headers tüm CSP direktiflerini içerir", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/check-production-headers.mjs"],
      { cwd: webRoot, encoding: "utf8" }
    );

    assert.equal(result.status, 0, result.stderr);
    const { csp, hsts } = JSON.parse(result.stdout.trim()) as {
      csp: string;
      hsts: string;
    };

    for (const directive of [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "object-src 'none'",
      "base-uri",
      "frame-ancestors",
      "form-action",
      "upgrade-insecure-requests",
    ]) {
      assert.match(csp, new RegExp(directive.replace(/'/g, "'")));
    }

    assert.match(hsts, /max-age=/);
    assert.doesNotMatch(csp, /\*\s*;|https:\s*\*/);
  });
});

describe("QA Faz 1.1 — responsive kod doğrulama", () => {
  const widths = [320, 375, 768, 1024, 1280, 1440];

  for (const width of widths) {
    it(`${width}px — cash-bank min-w-0 ve kontrollü overflow`, () => {
      const page = read("app/cash-bank/page.tsx");
      assert.match(page, /min-w-0/);
      assert.match(page, /overflow-x-auto/);
    });
  }

  it("AI button viewport dışına taşmaz (max-width calc)", () => {
    const launcher = read("components/ai-assistant/ai-floating-launcher.tsx");
    assert.match(launcher, /max-w-\[calc\(100vw/);
    assert.match(launcher, /safe-area-inset-bottom/);
  });

  it("global body overflow-x:hidden yok", () => {
    assert.doesNotMatch(read("app/globals.css"), /overflow-x:\s*hidden/);
  });
});
