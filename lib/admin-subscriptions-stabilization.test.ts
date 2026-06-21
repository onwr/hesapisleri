import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { isBillingProrationEnabled } from "@/lib/billing/billing-feature-flags";

describe("billing proration feature flag", () => {
  const original = process.env.BILLING_PRORATION_ENABLED;

  after(() => {
    if (original === undefined) delete process.env.BILLING_PRORATION_ENABLED;
    else process.env.BILLING_PRORATION_ENABLED = original;
  });

  it("defaults to disabled", () => {
    delete process.env.BILLING_PRORATION_ENABLED;
    assert.equal(isBillingProrationEnabled(), false);
  });

  it("enables when env true", () => {
    process.env.BILLING_PRORATION_ENABLED = "true";
    assert.equal(isBillingProrationEnabled(), true);
  });
});

describe("admin subscription list backfill policy", () => {
  it("listAdminSubscriptions export exists without auto backfill side effect contract", async () => {
    const { readFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const dir = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(join(dir, "admin-subscription-service.ts"), "utf8");
    const listFn =
      source.match(
        /export async function listAdminSubscriptions[\s\S]*?(?=\nexport async function|\nexport const|\nexport type|\nexport class|\Z)/
      )?.[0] ?? "";
    assert.match(listFn, /export async function listAdminSubscriptions/);
    assert.doesNotMatch(listFn, /ensureSubscriptionsBackfill/);
    assert.doesNotMatch(listFn, /repairMissingSubscriptions/);
  });

  it("repairMissingSubscriptions requires confirm when not dry-run", async () => {
    const { AdminSubscriptionError, repairMissingSubscriptions } = await import(
      "@/lib/admin-subscription-service"
    );
    await assert.rejects(
      () => repairMissingSubscriptions({ dryRun: false, confirm: false }),
      (error: unknown) => {
        assert.ok(error instanceof AdminSubscriptionError);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });
});

describe("manual extension schema", () => {
  it("requires positive amount for manual payment extension", async () => {
    const { manualExtensionSchema } = await import("@/lib/admin-subscription-service");
    assert.throws(() =>
      manualExtensionSchema.parse({
        extensionType: "MANUAL_PAYMENT",
        mode: "MONTH_1",
        amountMinor: 0,
        reason: "test payment",
      })
    );
  });

  it("accepts complimentary extension without payment", async () => {
    const { manualExtensionSchema } = await import("@/lib/admin-subscription-service");
    const parsed = manualExtensionSchema.parse({
      extensionType: "COMPLIMENTARY",
      mode: "MONTH_1",
      reason: "free extension",
    });
    assert.equal(parsed.extensionType, "COMPLIMENTARY");
  });
});

describe("admin subscription filters", () => {
  it("parses partner scope and price source", async () => {
    const { parseAdminSubscriptionFilters } = await import("@/lib/admin-subscription-utils");
    const filters = parseAdminSubscriptionFilters({
      partnerScope: "WITH",
      priceSource: "GRANDFATHERED",
    });
    assert.equal(filters.partnerScope, "WITH");
    assert.equal(filters.priceSource, "GRANDFATHERED");
  });
});
