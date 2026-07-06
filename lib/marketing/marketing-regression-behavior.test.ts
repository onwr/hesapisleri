/**
 * Marketing + Faz 21 + Faz 16.1 birleşik regression
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  ACTIVE_MARKETPLACE_KEYS,
  MARKETING_BUILTIN_INTEGRATIONS,
} from "@/lib/marketing/integration-catalog";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function src(...segments: string[]) {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

function exists(...segments: string[]) {
  return existsSync(join(webRoot, ...segments));
}

describe("integration catalog — kod tabanı uyumu", () => {
  it("aktif pazaryeri yalnız Trendyol ve Hepsiburada", () => {
    assert.deepEqual(ACTIVE_MARKETPLACE_KEYS.sort(), ["HEPSIBURADA", "TRENDYOL"]);
  });

  it("builtin entegrasyonlar SMS veya mobil uygulama içermez", () => {
    const names = MARKETING_BUILTIN_INTEGRATIONS.map((item) => item.name);
    assert.ok(!names.some((name) => /SMS|Mobil Uygulama/i.test(name)));
    assert.ok(names.includes("Sipay"));
    assert.ok(names.some((name) => name.includes("e-Fatura")));
  });

  it("N11 ve ÇiçekSepeti anasayfada gösterilir, sync adaptörü aktif değil", () => {
    const integ = src("components/marketing/integrations-section.tsx");
    const catalog = src("lib/marketing/integration-catalog.ts");
    assert.match(catalog, /key: "N11"/);
    assert.match(catalog, /key: "CICEKSEPETI"/);
    assert.doesNotMatch(integ, /Yakında/);
    assert.match(integ, /MARKETING_MARKETPLACE_INTEGRATIONS/);
  });
});

describe("responsive overflow contract", () => {
  const files = [
    "components/marketing/hero-section.tsx",
    "components/marketing/comparison-section.tsx",
    "components/marketing/integrations-section.tsx",
    "components/marketing/mobile-experience-section.tsx",
    "components/marketing/pricing-section.tsx",
    "components/marketing/marketing-header.tsx",
    "components/marketing/marketing-footer.tsx",
  ];

  for (const file of files) {
    it(`${file} uses min-w-0 or overflow containment`, () => {
      const content = src(file);
      const hasContainment =
        content.includes("min-w-0") ||
        content.includes("overflow-x-auto") ||
        content.includes("overflow-hidden") ||
        content.includes("max-w-");
      assert.ok(hasContainment, `${file} missing responsive containment`);
    });
  }

  it("hero avoids fixed large min-width overflow", () => {
    const hero = src("components/marketing/hero-section.tsx");
    assert.doesNotMatch(hero, /min-w-\[(?:[4-9]\d{2,}|[1-9]\d{3,})px\]/);
  });

  it("comparison table scrolls horizontally on narrow screens", () => {
    assert.match(src("components/marketing/comparison-section.tsx"), /overflow-x-auto/);
  });
});

describe("header/footer — gerçek route ve section linkleri", () => {
  const header = src("components/marketing/marketing-header.tsx");
  const footer = src("components/marketing/marketing-footer.tsx");

  it("header has no empty hash-only nav items", () => {
    assert.doesNotMatch(header, /href="#"\s*/);
    assert.doesNotMatch(header, /href='#'\s*/);
  });

  it("header does not reference Kaynaklar or Kurumsal without targets", () => {
    assert.doesNotMatch(header, /Kaynaklar|Kurumsal/);
  });

  it("footer has no empty hash links", () => {
    assert.doesNotMatch(footer, /href="#"\s*/);
  });

  it("footer legal routes exist", () => {
    assert.ok(exists("app", "kvkk", "page.tsx"));
    assert.ok(exists("app", "kvkk-aydinlatma-metni", "page.tsx"));
  });
});

describe("Faz 21 deployment dosyaları korunur", () => {
  const paths = [
    "Dockerfile",
    ".dockerignore",
    "docker-compose.production.yml",
    "lib/deployment/env-validation.ts",
    "scripts/production-smoke.mjs",
    "scripts/db-backup.sh",
    "scripts/db-backup.ps1",
    "app/api/health/live/route.ts",
    "app/api/health/ready/route.ts",
    "lib/pos-checkout-idempotency.ts",
  ];

  for (const rel of paths) {
    it(`${rel} mevcut`, () => {
      assert.ok(exists(rel), `Missing: ${rel}`);
    });
  }

  it("deployment backup dokümantasyonu mevcut", () => {
    assert.ok(existsSync(join(webRoot, "..", "docs", "deployment", "backup-restore.md")));
  });

  it("CI workflow mevcut", () => {
    assert.ok(
      existsSync(join(webRoot, "..", ".github", "workflows", "ci.yml")) ||
        existsSync(join(webRoot, ".github", "workflows", "ci.yml"))
    );
  });

  it("POS idempotency migration mevcut", () => {
    assert.ok(
      exists("prisma", "migrations", "20260714120000_sale_pos_idempotency", "migration.sql")
    );
  });
});

describe("Faz 16.1 Sistem Sağlığı düzeltmeleri korunur", () => {
  const paths = [
    "lib/admin/system-health/health-migration-utils.ts",
    "lib/admin/system-health/health-memory-utils.ts",
    "lib/admin/system-health/health-redaction.ts",
    "lib/admin/system-health/health-cron-utils.ts",
    "lib/admin/system-health/faz-16-1-behavior.test.ts",
    "components/admin/system-health/health-check-details.tsx",
  ];

  for (const rel of paths) {
    it(`${rel} mevcut`, () => {
      assert.ok(exists(rel), `Missing: ${rel}`);
    });
  }

  it("migration health rolled_back_at filtresi", () => {
    const checks = src("lib/admin/system-health/system-health-checks.ts");
    assert.match(checks, /rolled_back_at/);
    assert.match(checks, /evaluateMigrationHealth/);
  });

  it("billing outbox registry stuck eşiği", () => {
    const checks = src("lib/admin/system-health/system-health-checks.ts");
    assert.match(checks, /getJobDefinition\("billing-outbox"\)/);
    assert.match(checks, /countStuckOutboxPending/);
  });

  it("sistem sağlığı sidebar menüsünde görünmez", () => {
    const nav = src("components/admin/layout/admin-navigation.ts");
    assert.doesNotMatch(nav, /href: "\/admin\/system-health"/);
    assert.doesNotMatch(nav, /id: "system-health"/);
  });
});

describe("AI insights demo etiketi", () => {
  const section = src("components/marketing/ai-insights-section.tsx");

  it("kartlarda Demo etiketi var", () => {
    assert.match(section, /Demo/);
  });

  it("footer demo açıklaması var", () => {
    assert.match(section, /Demo verilerdir/);
  });
});
