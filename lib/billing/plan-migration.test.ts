/**
 * Arşivlenmiş plan abone taşıma testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const MIGRATION_SERVICE_PATH = "lib/admin/plans/admin-plan-migration-service.ts";
const TARGET_PRICE_UTILS_PATH = "lib/admin/plans/admin-plan-target-price-utils.ts";
const CANONICAL_PERIOD_PATH = "lib/billing/canonical-billing-period.ts";
const MODAL_PATH = "components/admin/plans/admin-plan-migration-modal.tsx";
const ROUTE_PATH = "app/api/admin/plans/[id]/migration/migrate/route.ts";

describe("migration — canonical period resolution", () => {
  it("uses resolveCanonicalBillingPeriod in migration service", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes("resolveCanonicalBillingPeriod"));
    assert.ok(content.includes("fallbackTargetPeriod"));
  });

  it("legacy MONTH normalizes to MONTHLY", async () => {
    // node --test'in raw ESM loader'ı "@/" path alias'ını çözemiyor (yalnız
    // Next.js derleyicisinde çalışır) — bu yüzden kaynak taramayla doğrulanıyor.
    const content = await fs.readFile(CANONICAL_PERIOD_PATH, "utf8");
    assert.ok(content.includes('case "MONTH":'));
    assert.ok(content.includes('return "MONTHLY";'));
  });
});

describe("migration — target price loading", () => {
  it("uses shared effective price resolver aligned with checkout", async () => {
    const content = await fs.readFile(TARGET_PRICE_UTILS_PATH, "utf8");
    assert.ok(content.includes("assertSingleEffectivePrice"));
    assert.ok(content.includes('status: { in: ["ACTIVE", "SCHEDULED"] }'));
    assert.ok(content.includes("salePriceMinor <= 0"));
  });

  it("migration service loads target prices via loadTargetActivePricesByPeriod", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes("loadTargetActivePricesByPeriod"));
    assert.ok(!content.includes("Object.values(input.periodMapping).includes(interval)"));
  });
});

describe("migration — fallback target period", () => {
  it("route accepts fallbackTargetPeriod", async () => {
    const content = await fs.readFile(ROUTE_PATH, "utf8");
    assert.ok(content.includes("fallbackTargetPeriod"));
  });

  it("modal sends fallback for unresolved source periods", async () => {
    const content = await fs.readFile(MODAL_PATH, "utf8");
    assert.ok(content.includes("fallbackTargetPeriod"));
    assert.ok(content.includes("belirlenemedi"));
    assert.ok(content.includes("sourcePeriodUnresolved"));
  });
});

describe("migration — immediate transfer", () => {
  it("updates planId and billingInterval without touching period dates", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes("planId: input.targetPlanId"));
    assert.ok(content.includes("billingInterval: mappedInterval"));
    assert.ok(content.includes("nextPlanPriceId: targetPrice.id"));
    assert.ok(!content.match(/companySubscription\.update\([\s\S]*?currentPeriodStart:/));
    assert.ok(!content.match(/companySubscription\.update\([\s\S]*?currentPeriodEnd:/));
    assert.ok(!content.includes("membershipPayment.update"));
  });

  it("cancels pending plan changes on immediate migration", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes('subscriptionPendingChange.updateMany'));
    assert.ok(content.includes('status: "CANCELLED"'));
  });
});

describe("migration — result messaging", () => {
  it("groups skipped reasons without listing subscription ids in modal", async () => {
    const modal = await fs.readFile(MODAL_PATH, "utf8");
    assert.ok(modal.includes("skipGroups"));
    assert.ok(!modal.includes("s.subscriptionId}: {s.reason}"));
  });

  it("service returns summary message", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes("formatMigrationResult"));
    assert.ok(content.includes("skipGroups"));
  });
});

describe("migration — billing cache", () => {
  it("invalidates subscription and plan caches after migration", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes("invalidateAdminSubscriptionCaches"));
    assert.ok(content.includes("invalidateAdminPlanCaches"));
    assert.ok(content.includes("invalidateAdminPlanEntitlementCaches"));
  });
});

describe("migration — DRAFT price handling", () => {
  it("reports draft target price clearly", async () => {
    const content = await fs.readFile(MIGRATION_SERVICE_PATH, "utf8");
    assert.ok(content.includes('status: "DRAFT"'));
    assert.ok(content.includes("TARGET_PRICE_DRAFT"));
  });
});
