/**
 * Faz 6.1 — plan detay, preview HMAC, publish davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  signPlanPricePreview,
  verifyPlanPricePreview,
  getPlanPricePreviewSecret,
  PLAN_PRICE_PREVIEW_TTL_MS,
  type PlanPricePreviewCanonicalPayload,
} from "@/lib/admin/plans/admin-plan-preview-hash";
import { priceRangesOverlap } from "@/lib/admin/plans/admin-plan-price-overlap";
import {
  assertSingleEffectivePrice,
  PriceResolutionConflictError,
} from "@/lib/admin/plans/admin-plan-price-resolution-utils";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";
import { assertNoForbiddenPlanPatchKeys } from "@/lib/admin/plans/admin-plan-schemas";
import { hasBlockingIssuesForActivate } from "@/lib/admin/plans/admin-plan-detail-issue-service";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SECRET = "plan-preview-secret-32chars-min";

function samplePayload(overrides: Partial<PlanPricePreviewCanonicalPayload> = {}): PlanPricePreviewCanonicalPayload {
  const now = Date.now();
  return {
    planId: "plan-1",
    currentPriceId: "price-old",
    billingInterval: "MONTHLY",
    currency: "TRY",
    listPriceMinor: 10000,
    salePriceMinor: 9900,
    vatRate: 20,
    vatIncluded: false,
    effectiveFrom: new Date().toISOString(),
    effectiveUntil: null,
    priceChangePolicy: "NEW_SUBSCRIBERS_ONLY",
    isPublic: true,
    affectedSubscriptionSummary: {
      activeTotal: 5,
      withPriceLock: 2,
      withoutPriceLock: 3,
      nextRenewalPlanned: 1,
      grandfathered: 0,
      pendingPlanChanges: 0,
    },
    issuedByUserId: "admin-1",
    issuedAt: now,
    expiresAt: now + PLAN_PRICE_PREVIEW_TTL_MS,
    ...overrides,
  };
}

describe("Faz 6.1 preview HMAC", () => {
  const envKey = "PLAN_PRICE_PREVIEW_SECRET";
  const prev = process.env[envKey];
  const prevJwt = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "different-jwt-secret-value";

  it("public secret yoksa friendly mesaj", () => {
    delete process.env[envKey];
    assert.throws(() => getPlanPricePreviewSecret(), /Paylaşılabilir/);
  });

  it("secret çakışması reddedilir (JWT_SECRET ile aynı)", () => {
    process.env[envKey] = "same-secret-value-16c";
    process.env.JWT_SECRET = "same-secret-value-16c";
    assert.throws(() => getPlanPricePreviewSecret());
  });

  it("token tampering reddedilir", () => {
    process.env[envKey] = SECRET;
    process.env.JWT_SECRET = "different-jwt-secret-value";
    const payload = samplePayload();
    const token = signPlanPricePreview(payload, SECRET);
    const bad = verifyPlanPricePreview(token, samplePayload({ planId: "other" }), SECRET);
    assert.equal(bad.valid, false);
    assert.equal(bad.tampered, true);
  });

  it("token expiry", () => {
    process.env[envKey] = SECRET;
    const payload = samplePayload();
    const token = signPlanPricePreview(payload, SECRET);
    const expired = verifyPlanPricePreview(token, payload, SECRET, payload.expiresAt + 1);
    assert.equal(expired.expired, true);
    assert.equal(expired.valid, false);
  });

  it("geçerli token doğrulanır", () => {
    process.env[envKey] = SECRET;
    const payload = samplePayload();
    const token = signPlanPricePreview(payload, SECRET);
    const ok = verifyPlanPricePreview(token, payload, SECRET);
    assert.equal(ok.valid, true);
  });

  if (prev !== undefined) process.env[envKey] = prev;
  else delete process.env[envKey];
  if (prevJwt !== undefined) process.env.JWT_SECRET = prevJwt;
  else delete process.env.JWT_SECRET;
});

describe("Faz 6.1 lifecycle source", () => {
  it("activate/archive transaction senkronu", () => {
    const src = readFileSync(join(webRoot, "lib/admin/plans/admin-plan-action-service.ts"), "utf8");
    assert.ok(src.includes('planStatus: "ACTIVE"') && src.includes("isActive: true"));
    assert.ok(src.includes('planStatus: "ARCHIVED"') && src.includes("isActive: false"));
    assert.ok(src.includes("invalidateAdminPlanCaches"));
  });

  it("generic PATCH lifecycle reddi", () => {
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ planStatus: "ACTIVE" }));
    assert.throws(() => assertNoForbiddenPlanPatchKeys({ monthlyPrice: 99 }));
  });
});

describe("Faz 6.1 pricing overlap", () => {
  const d = (iso: string) => new Date(iso);

  it("boundary overlap kabul", () => {
    assert.equal(
      priceRangesOverlap(
        { effectiveFrom: d("2026-01-01"), effectiveUntil: d("2026-06-01") },
        { effectiveFrom: d("2026-06-01"), effectiveUntil: d("2026-12-01") }
      ),
      false
    );
  });

  it("farklı currency conflict değil", () => {
    const now = d("2026-06-15");
    const tryPrice = assertSingleEffectivePrice(
      [
        {
          billingInterval: "MONTHLY" as const,
          currency: "TRY",
          status: "ACTIVE",
          effectiveFrom: d("2026-01-01"),
          effectiveUntil: null,
        },
      ],
      "MONTHLY",
      "TRY",
      now
    );
    assert.ok(tryPrice);
    const usdOnly = assertSingleEffectivePrice(
      [
        {
          billingInterval: "MONTHLY" as const,
          currency: "USD",
          status: "ACTIVE",
          effectiveFrom: d("2026-01-01"),
          effectiveUntil: null,
        },
      ],
      "MONTHLY",
      "USD",
      now
    );
    assert.ok(usdOnly);
  });

  it("scheduled effective resolution", () => {
    const now = d("2026-06-15");
    const prices = [
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "SCHEDULED",
        effectiveFrom: d("2026-06-01"),
        effectiveUntil: null,
      },
    ];
    const effective = assertSingleEffectivePrice(prices, "MONTHLY", "TRY", now);
    assert.ok(effective);
  });
});

describe("Faz 6.1 checkout", () => {
  it("standard active public effective", () => {
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
  });

  it("archived reddi", () => {
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

describe("Faz 6.1 route security", () => {
  const routes = [
    "app/api/admin/plans/[id]/prices/preview/route.ts",
    "app/api/admin/plans/[id]/prices/publish/route.ts",
    "app/api/admin/plans/[id]/prices/route.ts",
  ];
  for (const route of routes) {
    it(`${route} super admin`, () => {
      assert.ok(readFileSync(join(webRoot, route), "utf8").includes("requireSuperAdminApi"));
    });
  }
});

describe("Faz 6.1 publish requires preview", () => {
  it("publish servisi expectedCurrentPriceId ile stale kontrolü yapar", () => {
    const src = readFileSync(
      join(webRoot, "lib/admin/plans/admin-plan-price-preview-service.ts"),
      "utf8"
    );
    assert.ok(src.includes("expectedCurrentPriceId"));
    assert.ok(src.includes("PreviewStaleError"));
    assert.ok(src.includes("applyPriceChangePolicyOnPublish"));
  });
});

describe("activate blocking issues", () => {
  it("duplicate active price blocks activate", () => {
    const blocked = hasBlockingIssuesForActivate([
      {
        code: "DUPLICATE_ACTIVE_PRICE",
        severity: "error",
        message: "x",
      },
    ]);
    assert.equal(blocked, true);
  });
});
