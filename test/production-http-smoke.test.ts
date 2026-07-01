/**
 * Production HTTP smoke — standalone build üzerinde robots/sitemap/404/CSP.
 * Canonical npm test dışında: npm run test:production-http-smoke
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Production HTTP smoke", () => {
  it("robots/sitemap/404 production build HTTP kontrolleri", () => {
    if (!existsSync(join(webRoot, ".next", "standalone", "server.js"))) {
      console.log("SKIP: standalone build yok — önce next build çalıştırın");
      return;
    }

    const result = spawnSync(process.execPath, ["scripts/qa-faz-1-1-http-check.mjs"], {
      cwd: webRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        QA_HTTP_PORT: "3099",
        BILLING_PAYMENT_PROVIDER: "PAYTR",
        PAYTR_ENABLED: "true",
        PAYTR_MERCHANT_ID: "smoke-merchant",
        PAYTR_MERCHANT_KEY: "smoke-merchant-key",
        PAYTR_MERCHANT_SALT: "smoke-merchant-salt",
        SIPAY_ENABLED: "false",
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ??
          "postgresql://postgres:kurkaya1234@127.0.0.1:5432/hesapisleri_test",
      },
      timeout: 120_000,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});
