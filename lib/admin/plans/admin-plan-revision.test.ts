/**
 * Admin plan revizyonu — davranış ve güvenlik testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  getPlanPricePreviewSecret,
  signPlanPricePreview,
  verifyPlanPricePreview,
  PLAN_PRICE_PREVIEW_TTL_MS,
  type PlanPricePreviewCanonicalPayload,
} from "@/lib/admin/plans/admin-plan-preview-hash";
import {
  ADMIN_PRICE_POLICY_OPTIONS,
  getPricePolicyLabel,
} from "@/lib/admin/plans/admin-plan-price-policy-labels";
import { getPlanListStatusLabel } from "@/lib/admin/plans/admin-plan-status-labels";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function samplePayload(
  overrides: Partial<PlanPricePreviewCanonicalPayload> = {}
): PlanPricePreviewCanonicalPayload {
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
    issuedByUserId: "admin-user-1",
    issuedAt: now,
    expiresAt: now + PLAN_PRICE_PREVIEW_TTL_MS,
    ...overrides,
  };
}

describe("admin preview without env secrets", () => {
  it("preview service session-only, no HMAC token", () => {
    const src = readSrc("lib/admin/plans/admin-plan-price-preview-service.ts");
    assert.ok(src.includes("expectedCurrentPriceId"));
    assert.ok(!src.includes("getAdminPlanPricePreviewSigningKey"));
    assert.ok(!src.includes("NEXTAUTH_SECRET"));
    assert.ok(!src.includes("previewToken"));
  });

  it("preview route passes user id and origin guard", () => {
    const src = readSrc("app/api/admin/plans/[id]/prices/preview/route.ts");
    assert.ok(src.includes("auth.user.id"));
    assert.ok(src.includes("verifyApiMutationOrigin"));
  });
});

describe("public preview secret remains optional", () => {
  const envKey = "PLAN_PRICE_PREVIEW_SECRET";
  const prev = process.env[envKey];

  it("missing public secret throws friendly message", () => {
    delete process.env[envKey];
    assert.throws(() => getPlanPricePreviewSecret(), /Paylaşılabilir önizleme/);
  });

  it("public HMAC still works when configured", () => {
    process.env[envKey] = "plan-preview-secret-32chars-min";
    process.env.JWT_SECRET = "different-jwt-secret-value";
    const payload = samplePayload();
    const token = signPlanPricePreview(payload, process.env[envKey]!);
    const ok = verifyPlanPricePreview(token, payload, process.env[envKey]!);
    assert.equal(ok.valid, true);
  });

  it("no raw env error in UI sources", () => {
    const uiFiles = [
      "components/admin/plans/admin-plan-price-wizard.tsx",
      "components/admin/plans/admin-plans-list-shell.tsx",
      "components/admin/plans/admin-plan-row-actions.tsx",
    ];
    for (const file of uiFiles) {
      assert.ok(!readSrc(file).includes("PLAN_PRICE_PREVIEW_SECRET"));
      assert.ok(!readSrc(file).includes("NEXTAUTH_SECRET"));
    }
  });

  if (prev !== undefined) process.env[envKey] = prev;
  else delete process.env[envKey];
});

describe("plan lifecycle routes", () => {
  it("DELETE endpoint exists with super admin guard", () => {
    const src = readSrc("app/api/admin/plans/[id]/route.ts");
    assert.ok(src.includes("export async function DELETE"));
    assert.ok(src.includes("requireSuperAdminApi"));
    assert.ok(src.includes("deleteAdminPlan"));
  });

  it("deactivate route exists", () => {
    const src = readSrc("app/api/admin/plans/[id]/deactivate/route.ts");
    assert.ok(src.includes("deactivateAdminPlan"));
    assert.ok(src.includes("requireSuperAdminApi"));
  });

  it("price cancel route exists", () => {
    const src = readSrc("app/api/admin/plans/[id]/prices/[priceId]/cancel/route.ts");
    assert.ok(src.includes("cancelScheduledAdminPlanPrice"));
  });
});

describe("friendly policy labels", () => {
  it("exposes three main policies for UI", () => {
    assert.equal(ADMIN_PRICE_POLICY_OPTIONS.length, 3);
    assert.ok(
      ADMIN_PRICE_POLICY_OPTIONS.some((o) => o.value === "NEW_SUBSCRIBERS_ONLY" && o.recommended)
    );
    assert.equal(getPricePolicyLabel("NEXT_RENEWAL"), "Mevcut abonelere yenileme tarihinde");
    assert.equal(getPlanListStatusLabel("ACTIVE", false), "Pasif");
    assert.equal(getPlanListStatusLabel("DRAFT", false), "Taslak");
  });
});

describe("delete eligibility helper", () => {
  it("exports assessment function in delete service", () => {
    const src = readSrc("lib/admin/plans/admin-plan-delete-service.ts");
    assert.ok(src.includes("assessAdminPlanDeleteEligibility"));
    assert.ok(src.includes("evaluatePlanDeleteEligibility"));
  });
});

describe("list UI copy", () => {
  it("uses Fiyatı Değiştir instead of yeni versiyon", () => {
    const pricing = readSrc("components/admin/plans/admin-plan-pricing-tab.tsx");
    const wizard = readSrc("components/admin/plans/admin-plan-price-wizard.tsx");
    assert.ok(pricing.includes("Fiyatı Değiştir"));
    assert.ok(!pricing.includes("Yeni versiyon"));
    assert.ok(wizard.includes("Fiyatı Değiştir"));
    assert.ok(!wizard.includes("Yeni fiyat versiyonu"));
  });
});
