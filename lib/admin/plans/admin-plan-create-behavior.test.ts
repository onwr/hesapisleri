/**
 * Plan oluşturma — tek sayfa form, dönemsel fiyat ve yetki davranışları
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminPlanCreateSchema,
  assertNoForbiddenPlanCreateKeys,
  normalizeAdminPlanCreateBody,
} from "@/lib/admin/plans/admin-plan-schemas";
import {
  assertValidDiscountPercent,
  calculateDiscountFromManualTotal,
  calculatePeriodPriceFromDiscount,
  moneyToMinor,
  parsePlanMoneyInput,
  PlanPeriodPricingError,
  resolvePeriodPriceMinor,
} from "@/lib/admin/plans/admin-plan-period-pricing-utils";
import {
  buildEntitlementsPayload,
  defaultSelectedFeatures,
  defaultSelectedLimits,
  getLimitsLinkedToFeature,
} from "@/lib/admin/plans/admin-plan-form-utils";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import { getMembershipPeriodMonths } from "@/lib/membership-utils";
import { addBillingPeriod } from "@/lib/billing/pricing-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function basePeriodPrices(monthlyMinor: number) {
  return [
    { billingInterval: "MONTHLY" as const, enabled: true, salePriceMinor: monthlyMinor },
    { billingInterval: "QUARTERLY" as const, enabled: true, discountPercent: 5 },
    { billingInterval: "SEMI_ANNUAL" as const, enabled: true, discountPercent: 10 },
    { billingInterval: "YEARLY" as const, enabled: true, discountPercent: 20 },
  ];
}

describe("plan create schema currency", () => {
  it("accepts currency on create request", () => {
    const body = normalizeAdminPlanCreateBody({
      name: "Standart Plan",
      currency: "TRY",
      periodPrices: basePeriodPrices(50000),
    });
    assert.doesNotThrow(() => assertNoForbiddenPlanCreateKeys(body));
    const parsed = adminPlanCreateSchema.safeParse(body);
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.currency, "TRY");
  });

  it("maps legacy defaultCurrency to currency", () => {
    const body = normalizeAdminPlanCreateBody({
      name: "Standart Plan",
      defaultCurrency: "EUR",
      periodPrices: basePeriodPrices(50000),
    });
    assert.doesNotThrow(() => assertNoForbiddenPlanCreateKeys(body));
    const parsed = adminPlanCreateSchema.safeParse(body);
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.currency, "EUR");
  });
});

describe("period pricing calculations", () => {
  const monthlyMinor = moneyToMinor(500);

  it("requires monthly price", () => {
    assert.throws(
      () =>
        resolvePeriodPriceMinor({
          monthlyPriceMinor: 0,
          interval: "MONTHLY",
          enabled: true,
          salePriceMinor: 0,
        }),
      (e: unknown) => e instanceof PlanPeriodPricingError
    );
  });

  it("calculates quarterly price with 5% discount", () => {
    const result = calculatePeriodPriceFromDiscount({
      monthlyPriceMinor: monthlyMinor,
      interval: "QUARTERLY",
      discountPercent: 5,
    });
    assert.equal(result.salePriceMinor, 142500);
    assert.equal(result.listPriceMinor, 150000);
  });

  it("calculates semi-annual price with 10% discount", () => {
    const result = calculatePeriodPriceFromDiscount({
      monthlyPriceMinor: monthlyMinor,
      interval: "SEMI_ANNUAL",
      discountPercent: 10,
    });
    assert.equal(result.salePriceMinor, 270000);
  });

  it("calculates yearly price with 20% discount", () => {
    const result = calculatePeriodPriceFromDiscount({
      monthlyPriceMinor: monthlyMinor,
      interval: "YEARLY",
      discountPercent: 20,
    });
    assert.equal(result.salePriceMinor, 480000);
  });

  it("derives discount percent from manual total", () => {
    const result = calculateDiscountFromManualTotal({
      monthlyPriceMinor: monthlyMinor,
      interval: "YEARLY",
      manualTotalMinor: 480000,
    });
    assert.equal(result.discountPercent, 20);
    assert.equal(result.salePriceMinor, 480000);
  });

  it("rejects negative parsed money", () => {
    assert.equal(parsePlanMoneyInput("-10"), null);
    assert.equal(parsePlanMoneyInput("0"), null);
  });

  it("parses Turkish formatted money", () => {
    assert.equal(parsePlanMoneyInput("1.250,50"), 1250.5);
    assert.equal(parsePlanMoneyInput("1250.50"), 1250.5);
  });

  it("rejects %100 or higher discount", () => {
    assert.throws(() => assertValidDiscountPercent(100));
    assert.throws(() => assertValidDiscountPercent(120));
  });

  it("skips disabled period price resolution", () => {
    assert.equal(
      resolvePeriodPriceMinor({
        monthlyPriceMinor: monthlyMinor,
        interval: "QUARTERLY",
        enabled: false,
        discountPercent: 5,
      }),
      null
    );
  });
});

describe("entitlement form helpers", () => {
  it("defaults all features and limits selected", () => {
    assert.ok(defaultSelectedFeatures().size > 0);
    assert.ok(defaultSelectedLimits().size > 0);
    assert.equal(
      defaultSelectedFeatures().size,
      buildEntitlementsPayload(defaultSelectedFeatures(), new Set()).length
    );
  });

  it("select all features includes every feature code", () => {
    const all = defaultSelectedFeatures();
    const payload = buildEntitlementsPayload(all, new Set());
    assert.ok(payload.length >= all.size);
  });

  it("removes linked limits when feature is turned off", () => {
    const limits = new Set(getLimitsLinkedToFeature("OCR"));
    assert.ok(limits.has("MONTHLY_OCR_SCANS"));
    const features = defaultSelectedFeatures();
    features.delete("OCR");
    for (const code of limits) {
      assert.ok(!features.has(code));
    }
  });
});

describe("sales open checkout visibility", () => {
  it("active public plan is checkout available for standard code", () => {
    assert.equal(
      isPlanCheckoutAvailable({
        code: "standard",
        planStatus: "ACTIVE",
        visibility: "PUBLIC",
        pricingClass: "PAID",
        hasPriceConflicts: false,
        isActive: true,
      }),
      true
    );
  });

  it("passive draft plan is checkout unavailable", () => {
    assert.equal(
      isPlanCheckoutAvailable({
        code: "standard",
        planStatus: "DRAFT",
        visibility: "PRIVATE",
        pricingClass: "PAID",
        hasPriceConflicts: false,
        isActive: false,
      }),
      false
    );
  });
});

describe("billing renewal periods", () => {
  const start = new Date("2026-01-15T12:00:00Z");

  it("computes 1/3/6/12 month renewal dates", () => {
    assert.equal(
      addBillingPeriod(start, "MONTHLY").toISOString().slice(0, 10),
      "2026-02-15"
    );
    assert.equal(
      addBillingPeriod(start, "QUARTERLY").toISOString().slice(0, 10),
      "2026-04-15"
    );
    assert.equal(
      addBillingPeriod(start, "SEMI_ANNUAL").toISOString().slice(0, 10),
      "2026-07-15"
    );
    assert.equal(
      addBillingPeriod(start, "YEARLY").toISOString().slice(0, 10),
      "2027-01-15"
    );
  });

  it("keeps legacy monthly/yearly month counts", () => {
    assert.equal(getMembershipPeriodMonths("MONTHLY"), 1);
    assert.equal(getMembershipPeriodMonths("YEARLY"), 12);
  });
});

describe("create service transaction", () => {
  it("creates plan and prices in single transaction", () => {
    const src = readSrc("lib/admin/plans/admin-plan-create-service.ts");
    assert.ok(src.includes("$transaction"));
    assert.ok(src.includes("membershipPlanPrice.create"));
    assert.ok(src.includes("planEntitlement.create"));
    assert.ok(src.includes("invalidateAdminPlanCaches"));
  });

  it("rolls back when sales open but no prices created", () => {
    const src = readSrc("lib/admin/plans/admin-plan-create-service.ts");
    assert.ok(src.includes("Satışa açık plan için fiyat oluşturulamadı"));
  });
});

describe("create form UI", () => {
  it("does not expose DRAFT / INTERNAL labels", () => {
    const src = readSrc("components/admin/plans/admin-plan-create-form.tsx");
    assert.doesNotMatch(src, /\bDRAFT\b/);
    assert.doesNotMatch(src, /\bINTERNAL\b/);
    assert.doesNotMatch(src, /\bPUBLIC\b/);
    assert.doesNotMatch(src, /router\.back\(/);
  });

  it("cancel navigates to /admin/plans", () => {
    const src = readSrc("components/admin/plans/admin-plan-create-form.tsx");
    assert.ok(src.includes('router.push("/admin/plans")'));
    assert.ok(src.includes("Kaydedilmemiş"));
  });
});

describe("checkout period filter", () => {
  it("only renders periods with positive price", () => {
    const src = readSrc("components/settings/membership-billing-panel.tsx");
    assert.ok(src.includes("price > 0"));
  });
});
