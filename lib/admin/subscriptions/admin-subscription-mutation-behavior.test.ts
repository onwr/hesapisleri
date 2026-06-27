/**
 * Real behavior tests for admin subscription mutations and validators.
 * Pure functions only — no DB, no server-only imports.
 */
import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import {
  signPreviewHash,
  verifyPreviewHash,
  PREVIEW_TTL_MS,
  type PreviewCanonicalPayload,
} from "./admin-subscription-preview-hash.js";
import {
  buildCanonicalPreviewPayload,
  calculateMrrWithDuplicateAwareness,
  interpretPreviewVerification,
  validateCancellationRevoke,
  validateCancellationSchedule,
  validateTrialExtension,
  MRR_POLICY_DESCRIPTION,
} from "./admin-subscription-action-validators.js";
import {
  resolveSubscriptionPreviewSecret,
  PREVIEW_SECRET_ERROR_CODE,
  PreviewSecretNotConfiguredError,
} from "./admin-subscription-preview-secret.js";

const SECRET = "test-subscription-preview-secret-min16";

function basePayload(overrides: Partial<PreviewCanonicalPayload> = {}): PreviewCanonicalPayload {
  const now = Date.now();
  return {
    subscriptionId: "sub_1",
    companyId: "co_1",
    currentPlanId: "plan_a",
    currentPlanPriceId: "pp_a",
    currentBillingInterval: "MONTHLY",
    targetPlanId: "plan_b",
    targetPlanPriceId: "pp_b",
    targetBillingInterval: "YEARLY",
    currency: "TRY",
    listPriceMinor: 10000,
    salePriceMinor: 9000,
    monthlyEquivalentMinor: 750,
    discountSummary: "",
    couponId: null,
    campaignId: null,
    activeAddOnEffectMinor: 0,
    effectiveMode: "NEXT_PERIOD",
    issuedAt: now,
    expiresAt: now + PREVIEW_TTL_MS,
    ...overrides,
  };
}

const env = process.env as Record<string, string | undefined>;

describe("Preview secret resolution", () => {
  const origNodeEnv = env.NODE_ENV;
  const origPreviewSecret = env.SUBSCRIPTION_PREVIEW_SECRET;
  const origAuthSecret = env.NEXTAUTH_SECRET;

  afterEach(() => {
    env.NODE_ENV = origNodeEnv;
    if (origPreviewSecret === undefined) delete env.SUBSCRIPTION_PREVIEW_SECRET;
    else env.SUBSCRIPTION_PREVIEW_SECRET = origPreviewSecret;
    if (origAuthSecret === undefined) delete env.NEXTAUTH_SECRET;
    else env.NEXTAUTH_SECRET = origAuthSecret;
  });

  it("uses SUBSCRIPTION_PREVIEW_SECRET in test when set", () => {
    env.NODE_ENV = "test";
    env.SUBSCRIPTION_PREVIEW_SECRET = "my-test-secret-at-least-16-chars";
    assert.equal(resolveSubscriptionPreviewSecret(), "my-test-secret-at-least-16-chars");
  });

  it("throws PREVIEW_SECRET_NOT_CONFIGURED in development without secret", () => {
    env.NODE_ENV = "development";
    delete env.SUBSCRIPTION_PREVIEW_SECRET;
    assert.throws(() => resolveSubscriptionPreviewSecret(), PreviewSecretNotConfiguredError);
    try {
      resolveSubscriptionPreviewSecret();
    } catch (e) {
      assert.equal((e as PreviewSecretNotConfiguredError).code, PREVIEW_SECRET_ERROR_CODE);
      assert.equal((e as PreviewSecretNotConfiguredError).status, 503);
    }
  });

  it("rejects secret identical to NEXTAUTH_SECRET", () => {
    env.NODE_ENV = "test";
    env.SUBSCRIPTION_PREVIEW_SECRET = "same-secret-value-16";
    env.NEXTAUTH_SECRET = "same-secret-value-16";
    assert.throws(() => resolveSubscriptionPreviewSecret());
  });
});

describe("Trial extension validation", () => {
  it("rejects non-TRIAL status", () => {
    const r = validateTrialExtension({ status: "ACTIVE", days: 7, baseDate: new Date() });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 400);
  });

  it("accepts valid extension within 90 days", () => {
    const base = new Date();
    const r = validateTrialExtension({ status: "TRIAL", days: 7, baseDate: base, now: base });
    assert.equal(r.ok, true);
  });

  it("rejects extension beyond 90 days", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const base = new Date("2026-01-01T00:00:00Z");
    const r = validateTrialExtension({
      status: "TRIAL",
      days: 100,
      baseDate: base,
      now,
    });
    assert.equal(r.ok, false);
  });
});

describe("Cancellation validation", () => {
  it("schedule rejects double schedule", () => {
    const r = validateCancellationSchedule({ status: "ACTIVE", cancelAtPeriodEnd: true });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 409);
  });

  it("revoke rejects when no scheduled cancellation", () => {
    const r = validateCancellationRevoke({ cancelAtPeriodEnd: false });
    assert.equal(r.ok, false);
  });

  it("revoke accepts scheduled cancellation", () => {
    const r = validateCancellationRevoke({ cancelAtPeriodEnd: true });
    assert.equal(r.ok, true);
  });
});

describe("Plan preview HMAC — full canonical payload", () => {
  it("includes all required business fields in payload", () => {
    const payload = buildCanonicalPreviewPayload({
      subscriptionId: "sub_1",
      companyId: "co_1",
      currentPlanId: "p1",
      currentPlanPriceId: "pp1",
      currentBillingInterval: "MONTHLY",
      targetPlanId: "p2",
      targetPlanPriceId: "pp2",
      targetBillingInterval: "YEARLY",
      currency: "TRY",
      listPriceMinor: 12000,
      salePriceMinor: 10000,
      monthlyEquivalentMinor: 833,
      discountSummary: "COUPON:SAVE10:2000",
      couponId: "c1",
      campaignId: "camp1",
      activeAddOnEffectMinor: 500,
      effectiveMode: "IMMEDIATELY",
      issuedAt: 1000,
      expiresAt: 1000 + PREVIEW_TTL_MS,
    });
    assert.equal(payload.companyId, "co_1");
    assert.equal(payload.targetPlanPriceId, "pp2");
    assert.equal(payload.couponId, "c1");
    assert.equal(payload.activeAddOnEffectMinor, 500);
    assert.equal(payload.effectiveMode, "IMMEDIATELY");
  });

  it("rejects expired preview", () => {
    const now = Date.now();
    const payload = basePayload({ issuedAt: now, expiresAt: now + PREVIEW_TTL_MS });
    const token = signPreviewHash(payload, SECRET, now);
    const result = verifyPreviewHash(token, payload, SECRET, now + PREVIEW_TTL_MS + 1);
    const interpreted = interpretPreviewVerification(result);
    assert.equal(interpreted.ok, false);
    if (!interpreted.ok) assert.equal(interpreted.code, "PREVIEW_EXPIRED");
  });

  it("rejects subscription mismatch", () => {
    const now = Date.now();
    const payload = basePayload();
    const token = signPreviewHash(payload, SECRET, now);
    const wrongSub = basePayload({ subscriptionId: "sub_OTHER" });
    const result = verifyPreviewHash(token, wrongSub, SECRET, now + 1000);
    assert.ok(result.tampered);
  });

  it("rejects currency change after preview", () => {
    const now = Date.now();
    const payload = basePayload({ currency: "TRY" });
    const token = signPreviewHash(payload, SECRET, now);
    const changed = basePayload({ currency: "USD" });
    const result = verifyPreviewHash(token, changed, SECRET, now + 1000);
    assert.ok(result.tampered);
  });

  it("rejects price change after preview", () => {
    const now = Date.now();
    const payload = basePayload({ salePriceMinor: 9000 });
    const token = signPreviewHash(payload, SECRET, now);
    const changed = basePayload({ salePriceMinor: 8000 });
    const result = verifyPreviewHash(token, changed, SECRET, now + 1000);
    assert.ok(result.tampered);
  });
});

describe("MRR duplicate policy", () => {
  it("sums all subscription records (may double-count duplicates)", () => {
    const { mrrMinor } = calculateMrrWithDuplicateAwareness([
      {
        companyId: "co_1",
        subscriptionId: "sub_1",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 10000 },
      },
      {
        companyId: "co_1",
        subscriptionId: "sub_2",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 5000 },
      },
    ]);
    assert.equal(mrrMinor.TRY, 15000);
  });

  it("reports duplicate company excess MRR separately", () => {
    const { duplicateCompanies } = calculateMrrWithDuplicateAwareness([
      {
        companyId: "co_1",
        subscriptionId: "sub_1",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 10000 },
      },
      {
        companyId: "co_1",
        subscriptionId: "sub_2",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 5000 },
      },
      {
        companyId: "co_2",
        subscriptionId: "sub_3",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 3000 },
      },
    ]);
    assert.equal(duplicateCompanies.length, 1);
    assert.equal(duplicateCompanies[0].companyId, "co_1");
    assert.equal(duplicateCompanies[0].subscriptionIds.length, 2);
    assert.equal(duplicateCompanies[0].excessMrrMinor.TRY, 5000);
  });

  it("documents policy explicitly", () => {
    assert.ok(MRR_POLICY_DESCRIPTION.includes("çift sayım"));
  });
});

describe("Cache invalidation — note service wiring", () => {
  it("note service calls invalidateAdminSubscriptionCaches on create/update/delete", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const content = readFileSync(
      join(webRoot, "lib/admin/subscriptions/admin-subscription-note-service.ts"),
      "utf8"
    );
    const createBlock = content.slice(content.indexOf("createAdminSubscriptionNote"));
    assert.ok(createBlock.includes("invalidateAdminSubscriptionCaches"));
    const updateBlock = content.slice(content.indexOf("updateAdminSubscriptionNote"));
    assert.ok(updateBlock.includes("invalidateAdminSubscriptionCaches"));
    const deleteBlock = content.slice(content.indexOf("deleteAdminSubscriptionNote"));
    assert.ok(deleteBlock.includes("invalidateAdminSubscriptionCaches"));
  });
});
