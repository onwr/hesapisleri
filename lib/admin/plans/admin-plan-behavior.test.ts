/**
 * Faz 6 plan yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { priceRangesOverlap, assertNoPriceOverlap } from "@/lib/admin/plans/admin-plan-price-overlap";
import { classifyPlanPricing } from "@/lib/admin/plans/admin-plan-classification";
import {
  assertNoForbiddenPlanPatchKeys,
  adminPlanMetadataPatchSchema,
} from "@/lib/admin/plans/admin-plan-schemas";
import {
  findEffectivePricesAt,
  findPriceResolutionConflicts,
  assertSingleEffectivePrice,
  PriceResolutionConflictError,
} from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("price overlap [effectiveFrom, effectiveUntil)", () => {
  const day = (n: number) => new Date(`2026-01-${String(n).padStart(2, "0")}T00:00:00Z`);

  it("open-ended + new price does not overlap when sequential", () => {
    const a = { effectiveFrom: day(1), effectiveUntil: null };
    const b = { effectiveFrom: day(10), effectiveUntil: null };
    assert.equal(priceRangesOverlap(a, b), false);
  });

  it("same-day boundary does not overlap", () => {
    const a = { effectiveFrom: day(1), effectiveUntil: day(10) };
    const b = { effectiveFrom: day(10), effectiveUntil: day(20) };
    assert.equal(priceRangesOverlap(a, b), false);
  });

  it("rejects truly intersecting ranges", () => {
    const a = { effectiveFrom: day(1), effectiveUntil: day(15) };
    const b = { effectiveFrom: day(10), effectiveUntil: day(20) };
    assert.equal(priceRangesOverlap(a, b), true);
    assert.throws(() =>
      assertNoPriceOverlap(b, [a], {
        planId: "p1",
        billingInterval: "MONTHLY",
        currency: "TRY",
      })
    );
  });
});

describe("pricing classification", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const base = {
    billingInterval: "MONTHLY" as const,
    currency: "TRY",
    status: "ACTIVE" as const,
    isPublic: true,
    effectiveFrom: new Date("2026-01-01"),
    effectiveUntil: null,
  };

  it("FREE when all purchasable prices are zero", () => {
    assert.equal(classifyPlanPricing([{ ...base, salePriceMinor: 0 }], now), "FREE");
  });

  it("PAID when purchasable price > 0", () => {
    assert.equal(classifyPlanPricing([{ ...base, salePriceMinor: 9900 }], now), "PAID");
  });

  it("MIXED when both zero and paid intervals exist", () => {
    assert.equal(
      classifyPlanPricing(
        [
          { ...base, salePriceMinor: 0 },
          { ...base, billingInterval: "YEARLY", salePriceMinor: 99000 },
        ],
        now
      ),
      "MIXED"
    );
  });

  it("UNCONFIGURED when no purchasable price", () => {
    assert.equal(
      classifyPlanPricing([{ ...base, isPublic: false, salePriceMinor: 0 }], now),
      "UNCONFIGURED"
    );
  });
});

describe("generic PATCH restrictions", () => {
  it("rejects planStatus and legacy price fields", () => {
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ planStatus: "ACTIVE" }));
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ isActive: true }));
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ monthlyPrice: 99 }));
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ features: ["x"] }));
  });

  it("accepts safe metadata only", () => {
    const parsed = adminPlanMetadataPatchSchema.safeParse({
      name: "Standart",
      trialDays: 14,
    });
    assert.equal(parsed.success, true);
  });
});

describe("price resolution conflicts", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("SCHEDULED with effectiveFrom <= now is effective", () => {
    const prices = [
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "SCHEDULED",
        effectiveFrom: new Date("2026-06-01"),
        effectiveUntil: null,
      },
    ];
    const effective = findEffectivePricesAt(prices, "MONTHLY", "TRY", now);
    assert.equal(effective.length, 1);
  });

  it("two effective prices produce PRICE_RESOLUTION_CONFLICT", () => {
    const prices = [
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "ACTIVE",
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: null,
      },
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "SCHEDULED",
        effectiveFrom: new Date("2026-06-01"),
        effectiveUntil: null,
      },
    ];
    const conflicts = findPriceResolutionConflicts(prices, now);
    assert.ok(conflicts.includes("MONTHLY"));
    assert.throws(
      () => assertSingleEffectivePrice(prices, "MONTHLY", "TRY", now),
      (err: unknown) => err instanceof PriceResolutionConflictError
    );
  });

  it("different currency is isolated", () => {
    const prices = [
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "ACTIVE",
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: null,
      },
      {
        billingInterval: "MONTHLY" as const,
        currency: "USD",
        status: "ACTIVE",
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: null,
      },
    ];
    assert.equal(findPriceResolutionConflicts(prices, now).length, 0);
  });
});

describe("checkout capacity", () => {
  it("only standard ACTIVE PUBLIC plan with purchasable price is checkout available", () => {
    assert.equal(
      isPlanCheckoutAvailable({
        code: "standard",
        planStatus: "ACTIVE",
        visibility: "PUBLIC",
        pricingClass: "PAID",
        hasPriceConflicts: false,
      }),
      true
    );
    assert.equal(
      isPlanCheckoutAvailable({
        code: "pro",
        planStatus: "ACTIVE",
        visibility: "PUBLIC",
        pricingClass: "PAID",
        hasPriceConflicts: false,
      }),
      false
    );
    assert.equal(
      isPlanCheckoutAvailable({
        code: "standard",
        planStatus: "ARCHIVED",
        visibility: "PUBLIC",
        pricingClass: "PAID",
        hasPriceConflicts: false,
      }),
      false
    );
  });
});

describe("activate/archive transaction source", () => {
  it("activate sets planStatus + isActive together", () => {
    const src = readSrc("lib/admin/plans/admin-plan-action-service.ts");
    assert.ok(src.includes('planStatus: "ACTIVE"'));
    assert.ok(src.includes("isActive: true"));
    assert.ok(src.includes("publishedAt:"));
    assert.ok(src.includes("$transaction"));
  });

  it("archive closes sales without deleting subscriptions", () => {
    const src = readSrc("lib/admin/plans/admin-plan-action-service.ts");
    assert.ok(src.includes('planStatus: "ARCHIVED"'));
    assert.ok(src.includes("isActive: false"));
    assert.ok(src.includes("confirmActiveSubscriptions"));
    assert.ok(src.includes("subscriptionPendingChange"));
  });
});

describe("price publish protection", () => {
  it("financial fields cannot be PATCHed on existing price row", () => {
    const publishSrc = readSrc("lib/admin/plans/admin-plan-price-publish-service.ts");
    assert.ok(publishSrc.includes("FORBIDDEN_PRICE_PATCH_FIELDS"));
    assert.ok(publishSrc.includes("Fiyatı Değiştir"));
    assert.ok(publishSrc.includes("applyPriceChangePolicyOnPublish"));
    assert.ok(publishSrc.includes("NEW_SUBSCRIBERS_ONLY"));
    assert.ok(publishSrc.includes("GRANDFATHERED"));
    assert.ok(publishSrc.includes("NEXT_RENEWAL"));
    assert.ok(publishSrc.includes("AFTER_DATE"));
    assert.ok(publishSrc.includes("currency: input.currency"));
  });

  it("legacy sync only for default currency", () => {
    const src = readSrc("lib/admin/plans/admin-plan-price-publish-service.ts");
    assert.ok(src.includes("priceCurrency !== defaultCurrency"));
  });
});

describe("route security", () => {
  const routes = [
    "app/api/admin/plans/route.ts",
    "app/api/admin/plans/[id]/route.ts",
    "app/api/admin/plans/[id]/activate/route.ts",
    "app/api/admin/plans/[id]/archive/route.ts",
  ];

  for (const route of routes) {
    it(`${route} uses requireSuperAdminApi`, () => {
      assert.ok(readSrc(route).includes("requireSuperAdminApi"));
    });
  }

  it("hard delete endpoint guarded for super admin", () => {
    const idRoute = readSrc("app/api/admin/plans/[id]/route.ts");
    assert.ok(idRoute.includes("export async function DELETE"));
    assert.ok(idRoute.includes("requireSuperAdminApi"));
  });
});

describe("preview HMAC secret policy", () => {
  it("admin preview session-only; public secret optional for share links", () => {
    const hashSrc = readSrc("lib/admin/plans/admin-plan-preview-hash.ts");
    const previewSrc = readSrc("lib/admin/plans/admin-plan-price-preview-service.ts");
    assert.ok(hashSrc.includes("getPlanPricePreviewSecret"));
    assert.ok(!hashSrc.includes("getAdminPlanPricePreviewSigningKey"));
    assert.ok(!hashSrc.includes("NEXTAUTH_SECRET"));
    assert.ok(previewSrc.includes("expectedCurrentPriceId"));
    assert.ok(!previewSrc.includes("signPlanPricePreview"));
  });
});
