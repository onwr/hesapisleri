import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function src(...segments: string[]): string {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

// ─── Route security: all routes use requireSuperAdminApi ─────────────────────

const ROUTE_FILES = [
  "app/api/admin/subscriptions/route.ts",
  "app/api/admin/subscriptions/[id]/route.ts",
  "app/api/admin/subscriptions/[id]/trial-extend/route.ts",
  "app/api/admin/subscriptions/[id]/plan-change/preview/route.ts",
  "app/api/admin/subscriptions/[id]/plan-change/apply/route.ts",
  "app/api/admin/subscriptions/[id]/cancellation/route.ts",
  "app/api/admin/subscriptions/[id]/sync-provider/route.ts",
  "app/api/admin/subscriptions/[id]/notes/route.ts",
  "app/api/admin/subscriptions/[id]/notes/[noteId]/route.ts",
];

describe("Admin subscription route security", () => {
  for (const file of ROUTE_FILES) {
    it(`${file} uses requireSuperAdminApi`, () => {
      const content = src(file);
      assert.ok(content.includes("requireSuperAdminApi"), `${file} should import requireSuperAdminApi`);
      assert.ok(content.includes('"error" in auth'), `${file} should check auth.error`);
    });
  }
});

// ─── Billing safety: no direct payment status mutation ────────────────────────

describe("Billing safety constraints", () => {
  it("action service never updates MembershipPayment status directly", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    const lines = content.split("\n");
    const paymentStatusUpdate = lines.filter(
      (l) => l.includes("membershipPayment") && l.includes("status") && l.includes("update")
    );
    assert.equal(paymentStatusUpdate.length, 0);
  });

  it("applyPlanChange verifies previewHash via HMAC before applying", () => {
    const action = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    const validators = src("lib/admin/subscriptions/admin-subscription-action-validators.ts");
    assert.ok(action.includes("previewHash"), "previewHash must be present");
    assert.ok(action.includes("verifyPreviewHash"), "HMAC verification required");
    assert.ok(validators.includes("Plan fiyatı değişti"), "User-facing error for stale preview required");
    assert.ok(validators.includes("Önizleme süresi doldu"), "Expiry error required");
  });

  it("preview hash uses HMAC not plain SHA256", () => {
    const hashUtil = src("lib/admin/subscriptions/admin-subscription-preview-hash.ts");
    assert.ok(hashUtil.includes("createHmac"), "Must use HMAC-SHA256, not plain hash");
    assert.ok(!hashUtil.includes("createHash("), "Must not use plain SHA256 for preview token");
    assert.ok(hashUtil.includes("expiresAt"), "Must include expiry in token");
    assert.ok(hashUtil.includes("subscriptionId"), "Must bind to subscriptionId");
  });

  it("preview hash includes all tamper-detectable fields", () => {
    const hashUtil = src("lib/admin/subscriptions/admin-subscription-preview-hash.ts");
    assert.ok(hashUtil.includes("currentPlanId"), "currentPlanId in canonical payload");
    assert.ok(hashUtil.includes("targetPlanId"), "targetPlanId in canonical payload");
    assert.ok(hashUtil.includes("currency"), "currency in canonical payload");
    assert.ok(hashUtil.includes("salePriceMinor"), "salePriceMinor in canonical payload");
  });

  it("action service does not create MembershipPayment directly", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(!content.includes("membershipPayment.create"), "Should not create payments directly");
  });
});

// ─── PayTR restriction ────────────────────────────────────────────────────────

describe("PayTR provider restrictions", () => {
  it("sync-provider marks PayTR as NOT_SUPPORTED", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(content.includes("NOT_SUPPORTED_PAYTR_MANUAL"), "PayTR sync should be marked as not supported");
  });

  it("sync-provider explains PayTR manual/iframe restriction", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(content.includes("PayTR iframe/manual"), "Should document PayTR restriction");
  });
});

// ─── Audit log safety ─────────────────────────────────────────────────────────

describe("Audit log safety", () => {
  it("audit service documents no-credential policy", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-audit.ts");
    assert.ok(content.includes("Credential") && content.includes("kart bilgisi"), "Credential policy must be documented");
  });

  it("audit service does not log password or tokenHash", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-audit.ts");
    assert.ok(!content.includes("password"), "No password in audit");
    assert.ok(!content.includes("tokenHash"), "No tokenHash in audit");
    assert.ok(!content.includes("rawToken"), "No rawToken in audit");
  });
});

// ─── Payment tab masking ──────────────────────────────────────────────────────

describe("Payment data masking", () => {
  it("payment tab uses maskProviderRef for merchantOid", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(content.includes("maskProviderRef(p.merchantOid)"), "merchantOid must be masked");
  });

  it("payment tab does not expose payer personal data", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(!content.includes("payerIp"), "payerIp should not be exposed");
    assert.ok(!content.includes("payerPhone"), "payerPhone should not be exposed");
    assert.ok(!content.includes("payerEmail"), "payerEmail should not be exposed");
  });

  it("maskProviderRef masks middle bytes", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-serializers.ts");
    assert.ok(content.includes("slice(0, 4)"), "Should keep first 4 chars");
    assert.ok(content.includes("****"), "Should use asterisks");
    assert.ok(content.includes("slice(-4)"), "Should keep last 4 chars");
  });
});

// ─── Schema constraints ───────────────────────────────────────────────────────

describe("Schema constraints", () => {
  it("applyPlanChangeSchema requires previewHash", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-schemas.ts");
    assert.ok(content.includes("previewHash: z.string().min(1)"), "previewHash required in apply schema");
  });

  it("extendTrialAdminSchema limits max to 90 days", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-schemas.ts");
    assert.ok(content.includes("max(90)"), "Max 90 day trial extension in schema");
  });

  it("adminExtendTrial enforces 90-day cap from today", () => {
    const action = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    const validators = src("lib/admin/subscriptions/admin-subscription-action-validators.ts");
    assert.ok(action.includes("validateTrialExtension"), "Trial validation must be called");
    assert.ok(validators.includes("90 * 24 * 60 * 60 * 1000"), "90 day cap in validator");
  });
});

// ─── Issue service ────────────────────────────────────────────────────────────

describe("Issue detection", () => {
  it("issue service defines labels for at least 10 issue types", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-issue-service.ts");
    // Count label lines: KEY: "Turkish label",
    const labelLines = content.split("\n").filter((l) => /^\s+[A-Z_]+: "/.test(l));
    assert.ok(labelLines.length >= 10, `Expected >=10 issue labels, got ${labelLines.length}`);
  });
});

// ─── MRR/ARR calculation ──────────────────────────────────────────────────────

describe("Revenue metrics", () => {
  it("metric service includes ACTIVE and CANCEL_AT_PERIOD_END for MRR", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-metric-service.ts");
    // CANCEL_AT_PERIOD_END subs still have active access — include in MRR
    const findManyIdx = content.lastIndexOf("companySubscription.findMany");
    const findManyBlock = content.slice(findManyIdx, findManyIdx + 500);
    assert.ok(findManyBlock.includes('"ACTIVE"'), "MRR must include ACTIVE");
    assert.ok(findManyBlock.includes('"CANCEL_AT_PERIOD_END"'), "MRR must include CANCEL_AT_PERIOD_END");
  });

  it("metric service excludes TRIAL from MRR", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-metric-service.ts");
    const findManyIdx = content.lastIndexOf("companySubscription.findMany");
    const findManyBlock = content.slice(findManyIdx, findManyIdx + 500);
    assert.ok(!findManyBlock.includes('"TRIAL"'), "MRR must not include TRIAL");
  });
});

// ─── Note service ─────────────────────────────────────────────────────────────

describe("Note service safety", () => {
  it("note service uses soft delete, not hard delete", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-note-service.ts");
    assert.ok(!content.includes("adminSubscriptionNote.delete("), "Hard delete not allowed");
    assert.ok(content.includes("deletedAt: new Date()"), "Soft delete required");
  });
});

// ─── Entitlement service ──────────────────────────────────────────────────────

describe("Entitlement service", () => {
  it("marks results as analyticsOnly with disclaimer", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-entitlement-service.ts");
    assert.ok(content.includes("analyticsOnly: true"), "analyticsOnly flag required");
    assert.ok(content.includes("disclaimer"), "Disclaimer required");
  });
});
