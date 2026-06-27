/**
 * Faz 10 — Merkezi fiyat önizleme davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  aggregateAddOnLines,
  assertNoForbiddenPreviewPriceKeys,
  buildPriceBreakdownSteps,
  comparePricePreviewScenarios,
  ensureNonNegativeFinal,
  redactPreviewPayload,
  stackingOrderFromDiscounts,
  validateSubscriptionBelongsToCompany,
} from "@/lib/admin/price-preview";
import { PricePreviewServiceError } from "@/lib/admin/price-preview/admin-price-preview-errors";
import { priceRangesOverlap } from "@/lib/admin/addons/admin-addon-price-overlap";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("price preview breakdown", () => {
  it("anonymous new subscription breakdown sırası", () => {
    const steps = buildPriceBreakdownSteps({
      currency: "TRY",
      listPriceMinor: 10000,
      salePriceMinor: 8000,
      priceSource: "PLAN_PRICE",
      appliedDiscounts: [
        { type: "PLAN", label: "Dönem", amountMinor: 2000 },
        { type: "CAMPAIGN", label: "Kampanya", amountMinor: 1000 },
        { type: "COUPON", label: "Kupon", amountMinor: 500 },
      ],
      vatMinor: 1440,
      subtotalMinor: 6500,
      totalMinor: 7940,
      monthlyEquivalentMinor: 7940,
    });
    assert.equal(steps[0]?.key, "plan_list");
    assert.equal(steps.find((s) => s.key === "campaign_discount")?.amountMinor, -1000);
    assert.equal(steps.find((s) => s.key === "final_total")?.amountMinor, 7940);
  });

  it("company override adımı", () => {
    const steps = buildPriceBreakdownSteps({
      currency: "TRY",
      listPriceMinor: 5000,
      salePriceMinor: 4500,
      priceSource: "COMPANY_OVERRIDE",
      appliedDiscounts: [{ type: "OVERRIDE", label: "Özel", amountMinor: 0 }],
      vatMinor: 810,
      subtotalMinor: 4500,
      totalMinor: 5310,
      monthlyEquivalentMinor: 5310,
      companyOverrideMinor: 4500,
    });
    assert.ok(steps.some((s) => s.key === "company_override"));
  });

  it("VAT ve final toplam", () => {
    const steps = buildPriceBreakdownSteps({
      currency: "EUR",
      listPriceMinor: 2000,
      salePriceMinor: 2000,
      priceSource: "PLAN_PRICE",
      appliedDiscounts: [],
      vatMinor: 400,
      subtotalMinor: 2000,
      totalMinor: 2400,
      monthlyEquivalentMinor: 2400,
    });
    assert.equal(steps.find((s) => s.key === "vat")?.amountMinor, 400);
    assert.equal(steps.find((s) => s.key === "monthly_equivalent")?.amountMinor, 2400);
  });
});

describe("campaign coupon stacking", () => {
  it("stacking sırası PLAN → CAMPAIGN → COUPON", () => {
    const order = stackingOrderFromDiscounts([
      { type: "COUPON", label: "K", amountMinor: 100 },
      { type: "PLAN", label: "P", amountMinor: 50 },
      { type: "CAMPAIGN", label: "C", amountMinor: 200 },
    ]);
    assert.deepEqual(
      order.map((o) => o.type),
      ["PLAN", "CAMPAIGN", "COUPON"]
    );
  });

  it("stacking conflict — overlap tespiti", () => {
    const a = { effectiveFrom: new Date("2026-01-01"), effectiveUntil: new Date("2026-12-01") };
    const b = { effectiveFrom: new Date("2026-06-01"), effectiveUntil: new Date("2027-06-01") };
    assert.equal(priceRangesOverlap(a, b), true);
  });
});

describe("add-on quantity ve currency", () => {
  it("add-on quantity toplamı plan currency ile", () => {
    const { addOnSubtotalMinor, currencyIssues } = aggregateAddOnLines(
      [
        { currency: "TRY", totalMinor: 3000, lineSaleMinor: 3000 },
        { currency: "TRY", totalMinor: 1500, lineSaleMinor: 1500 },
      ],
      "TRY"
    );
    assert.equal(addOnSubtotalMinor, 4500);
    assert.equal(currencyIssues.length, 0);
  });

  it("currency isolation — farklı PB eklenmez", () => {
    const { addOnSubtotalMinor, currencyIssues } = aggregateAddOnLines(
      [
        { currency: "TRY", totalMinor: 1000, lineSaleMinor: 1000 },
        { currency: "USD", totalMinor: 500, lineSaleMinor: 500 },
      ],
      "TRY"
    );
    assert.equal(addOnSubtotalMinor, 1000);
    assert.equal(currencyIssues.length, 1);
    assert.match(currencyIssues[0] ?? "", /ADDON_CURRENCY_MISMATCH/);
  });
});

describe("final fiyat ve karşılaştırma", () => {
  it("final fiyat negatif olmaz", () => {
    assert.equal(ensureNonNegativeFinal(-1).ok, false);
    assert.equal(ensureNonNegativeFinal(0).ok, true);
    assert.equal(ensureNonNegativeFinal(100).ok, true);
  });

  it("plan change karşılaştırma farkı", () => {
    const cmp = comparePricePreviewScenarios(
      {
        eligible: true,
        currency: "TRY",
        totalMinor: 10000,
        monthlyEquivalentMinor: 10000,
        entitlementCodes: ["MAX_USERS"],
        issues: [],
      },
      {
        eligible: true,
        currency: "TRY",
        totalMinor: 12000,
        monthlyEquivalentMinor: 12000,
        entitlementCodes: ["MAX_USERS", "MULTI_WAREHOUSE"],
        issues: [],
      }
    );
    assert.equal(cmp.comparable, true);
    assert.equal(cmp.priceDiffMinor, 2000);
    assert.equal(cmp.percentDiff, 20);
    assert.deepEqual(cmp.entitlementDiff.added, ["MULTI_WAREHOUSE"]);
  });

  it("currency mismatch karşılaştırma reddi", () => {
    const cmp = comparePricePreviewScenarios(
      {
        eligible: true,
        currency: "TRY",
        totalMinor: 1000,
        monthlyEquivalentMinor: 1000,
        entitlementCodes: [],
        issues: [],
      },
      {
        eligible: true,
        currency: "USD",
        totalMinor: 1000,
        monthlyEquivalentMinor: 1000,
        entitlementCodes: [],
        issues: [],
      }
    );
    assert.equal(cmp.comparable, false);
  });
});

describe("güvenlik ve auth", () => {
  it("client fiyat alanları reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPreviewPriceKeys({ planId: "x", finalTotal: 100 })
    );
    assert.throws(() =>
      assertNoForbiddenPreviewPriceKeys({ vatMinor: 20 })
    );
  });

  it("company/subscription ilişki doğrulaması", () => {
    assert.throws(
      () =>
        validateSubscriptionBelongsToCompany({
          subscriptionCompanyId: "company-a",
          companyId: "company-b",
        }),
      PricePreviewServiceError
    );
    assert.doesNotThrow(() =>
      validateSubscriptionBelongsToCompany({
        subscriptionCompanyId: "company-a",
        companyId: "company-a",
      })
    );
  });

  it("tenant admin reddi — requireSuperAdminApi", () => {
    assert.ok(readSrc("app/api/admin/price-preview/route.ts").includes("requireSuperAdminApi"));
    assert.ok(
      readSrc("app/api/admin/price-preview/options/route.ts").includes("requireSuperAdminApi")
    );
  });

  it("sensitive response redaction", () => {
    const out = redactPreviewPayload({
      plan: { name: "Pro" },
      secret: "hidden",
      nested: { apiKey: "x", ok: true },
    }) as Record<string, unknown>;
    assert.equal("secret" in out, false);
    assert.equal((out.nested as Record<string, unknown>).apiKey, undefined);
    assert.equal((out.nested as Record<string, unknown>).ok, true);
  });
});

describe("mutation-free preview", () => {
  it("preview servisi yazma işlemi içermez", () => {
    const src = readSrc("lib/admin/price-preview/admin-price-preview-service.ts");
    assert.ok(src.includes("resolveSubscriptionPrice"));
    assert.ok(src.includes("previewAddOnPrice"));
    assert.ok(!src.includes(".create("));
    assert.ok(!src.includes(".update("));
    assert.ok(!src.includes(".delete("));
    assert.ok(!src.includes("reserveDiscountRedemptions"));
    assert.ok(!src.includes("finalizeDiscountRedemptions"));
  });

  it("add-on create endpoint kullanılmaz", () => {
    const ui = readSrc("components/admin/price-preview/admin-price-preview-client.tsx");
    assert.ok(ui.includes("/api/admin/price-preview"));
    assert.ok(!ui.includes("/add-ons/"));
    assert.ok(!ui.includes("/prices"));
  });

  it("cache — options kısa, preview no-store", () => {
    const cache = readSrc("lib/admin/price-preview/admin-price-preview-cache.ts");
    assert.ok(cache.includes("no-store"));
    assert.ok(cache.includes("max-age"));
  });
});

describe("renewal locked price context", () => {
  it("locked renewal alanları subscription modelinde", () => {
    const schema = readFileSync(join(webRoot, "prisma/schema.prisma"), "utf8");
    assert.ok(schema.includes("lockedPlanPriceId"));
    assert.ok(schema.includes("lockedPriceMinor"));
    assert.ok(schema.includes("priceLockType"));
    assert.ok(schema.includes("nextPlanPriceId"));
    assert.ok(schema.includes("nextPriceEffectiveAt"));
  });
});
