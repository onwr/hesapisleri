/**
 * Marketplace feature flag — DB koruma + görünürlük kapanışı
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import {
  getSidebarVisibleHrefs,
  getSidebarVisibleLinkTitles,
} from "@/lib/sidebar-menu";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const DB_TARGET_CONFIGURED = TEST_DB_URL.includes("hesapisleri_test");

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("marketplace feature flag — DB koruma", () => {
  let db: PrismaClient | null = null;
  let dbReady = false;
  let companyId = "";
  let integrationId = "";
  const stamp = `mkt-flag-${Date.now()}`;

  before(async () => {
    assert.ok(
      DB_TARGET_CONFIGURED,
      "TEST_DATABASE_URL must point to hesapisleri_test"
    );

    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const company = await db.company.create({
      data: { name: `MktFlag_${stamp}`, status: "ACTIVE" },
    });
    companyId = company.id;

    const integration = await db.marketplaceIntegration.create({
      data: {
        companyId,
        channel: "TRENDYOL",
        status: "CONNECTED",
        syncEnabled: true,
        supplierId: `sup-${stamp}`,
        merchantId: `mer-${stamp}`,
        lastSyncStatus: "SUCCESS",
      },
    });
    integrationId = integration.id;
    dbReady = true;
  });

  after(async () => {
    if (!db || !companyId) return;
    try {
      await db.marketplaceIntegration.deleteMany({ where: { companyId } });
      await db.company.delete({ where: { id: companyId } });
    } catch {
      // cleanup best-effort
    }
    await db.$disconnect();
  });

  it("flag kapalıyken bağlı marketplace satırı silinmez", async () => {
    assert.equal(dbReady, true);
    assert.ok(db);
    assert.equal(
      isMarketplaceFeatureEnabled({ MARKETPLACE_FEATURE_ENABLED: "false" }),
      false
    );

    const row = await db.marketplaceIntegration.findUnique({
      where: { id: integrationId },
    });
    assert.ok(row);
    assert.equal(row.status, "CONNECTED");
    assert.equal(row.syncEnabled, true);
    assert.equal(row.supplierId, `sup-${stamp}`);
  });

  it("flag kapalıyken sidebar E-Ticaret /orders göstermez", () => {
    const titles = getSidebarVisibleLinkTitles("OWNER", true, {
      marketplaceEnabled: false,
    });
    const hrefs = getSidebarVisibleHrefs("OWNER", true, {
      marketplaceEnabled: false,
    });
    assert.ok(!titles.includes("Siparişler"));
    assert.ok(!titles.includes("Pazaryeri Entegrasyonları"));
    assert.ok(!hrefs.includes("/orders"));
  });

  it("flag açıkken sidebar orders ve integrations görünür", () => {
    const titles = getSidebarVisibleLinkTitles("OWNER", true, {
      marketplaceEnabled: true,
    });
    const hrefs = getSidebarVisibleHrefs("OWNER", true, {
      marketplaceEnabled: true,
    });
    assert.ok(titles.includes("Siparişler"));
    assert.ok(titles.includes("Pazaryeri Entegrasyonları"));
    assert.ok(hrefs.includes("/orders"));
    assert.ok(hrefs.includes("/settings/integrations"));
  });

  it("orders ve channel-mapping flag kapalıyken redirect eder", () => {
    assert.match(read("app/orders/layout.tsx"), /redirect\("\/dashboard"\)/);
    assert.match(
      read("app/products/channel-mapping/page.tsx"),
      /redirect\("\/products"\)/
    );
  });

  it("marketplace-sync cron flag kapalıyken skip eder", () => {
    const src = read("app/api/cron/marketplace-sync/route.ts");
    assert.match(src, /isMarketplaceFeatureEnabled/);
    assert.match(src, /skipped:\s*true/);
  });
});
