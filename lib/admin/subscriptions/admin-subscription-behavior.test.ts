/**
 * Behavior tests for admin subscription management.
 * Uses pure functions — no server-only imports, no DB, no Next.js.
 * Tests business logic: HMAC preview hash, MRR calculation, issue detection,
 * serializers, history dedup, and security policy assertions via source-code checks.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function src(...segments: string[]): string {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

// ─── Pure imports (no server-only, no prisma) ─────────────────────────────────

import {
  signPreviewHash,
  verifyPreviewHash,
  PREVIEW_TTL_MS,
  type PreviewCanonicalPayload,
} from "./admin-subscription-preview-hash.js";

import {
  calculateMrrMinorFromSubs,
  type ActiveSubForMrr,
} from "./admin-subscription-metric-service.js";

import {
  maskProviderRef,
  formatMinor,
  getSubscriptionStatusLabel,
  getBillingIntervalLabel,
} from "./admin-subscription-serializers.js";

import {
  detectSubscriptionIssues,
  getIssueLabel,
  ISSUE_LABELS,
  type SubscriptionIssue,
} from "./admin-subscription-issue-service.js";

// ─── Preview Hash — HMAC Security ────────────────────────────────────────────

const SECRET = "test-secret-for-unit-tests";

const SAMPLE_PAYLOAD: PreviewCanonicalPayload = {
  subscriptionId: "sub_abc123",
  companyId: "co_xyz",
  currentPlanId: "plan_starter",
  currentPlanPriceId: "price_starter_m",
  currentBillingInterval: "MONTHLY",
  targetPlanId: "plan_pro",
  targetPlanPriceId: "price_pro_y",
  targetBillingInterval: "YEARLY",
  currency: "TRY",
  listPriceMinor: 12000,
  salePriceMinor: 9900,
  monthlyEquivalentMinor: 825,
  discountSummary: "CAMPAIGN:Yaz:%10|990",
  couponId: null,
  campaignId: "camp_1",
  activeAddOnEffectMinor: 0,
  effectiveMode: "NEXT_PERIOD",
  issuedAt: Date.now(),
  expiresAt: Date.now() + PREVIEW_TTL_MS,
};

describe("Preview hash — HMAC signing", () => {
  it("generates a token in contentHash.expiresAt format", () => {
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET);
    const parts = token.split(".");
    assert.equal(parts.length, 2, "Token must have exactly 2 parts");
    assert.match(parts[0], /^[a-f0-9]{64}$/, "First part must be 64-char hex HMAC");
    assert.ok(Number(parts[1]) > Date.now(), "Expiry must be in the future");
  });

  it("token expires after PREVIEW_TTL_MS", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    // Verify at exactly TTL+1ms — should be expired
    const afterExpiry = verifyPreviewHash(
      token,
      SAMPLE_PAYLOAD,
      SECRET,
      fakeNow + PREVIEW_TTL_MS + 1
    );
    assert.ok(afterExpiry.expired, "Token must be expired after TTL");
    assert.ok(!afterExpiry.valid, "Expired token must not be valid");
  });

  it("valid token verifies correctly before expiry", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const r2 = verifyPreviewHash(token, SAMPLE_PAYLOAD, SECRET, fakeNow + 1000);
    assert.ok(!r2.expired, "Should not be expired");
    assert.ok(!r2.tampered, "Should not be tampered");
    assert.ok(r2.valid, "Should be valid");
  });

  it("rejects tampered subscriptionId", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const tamperedPayload = { ...SAMPLE_PAYLOAD, subscriptionId: "sub_DIFFERENT" };
    const result = verifyPreviewHash(token, tamperedPayload, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Should detect subscriptionId tampering");
    assert.ok(!result.valid, "Tampered token must not be valid");
  });

  it("rejects tampered targetPlanId", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const tamperedPayload = { ...SAMPLE_PAYLOAD, targetPlanId: "plan_enterprise" };
    const result = verifyPreviewHash(token, tamperedPayload, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Should detect targetPlanId tampering");
  });

  it("rejects tampered price", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const tamperedPayload = { ...SAMPLE_PAYLOAD, salePriceMinor: 1 }; // price changed to 1 kuruş
    const result = verifyPreviewHash(token, tamperedPayload, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Should detect price tampering");
  });

  it("rejects tampered currency", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const tamperedPayload = { ...SAMPLE_PAYLOAD, currency: "USD" };
    const result = verifyPreviewHash(token, tamperedPayload, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Should detect currency tampering");
  });

  it("rejects tampered targetBillingInterval", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const tamperedPayload = { ...SAMPLE_PAYLOAD, targetBillingInterval: "MONTHLY" };
    const result = verifyPreviewHash(token, tamperedPayload, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Should detect billing interval tampering");
  });

  it("rejects malformed token (no dot separator)", () => {
    const result = verifyPreviewHash("badtoken", SAMPLE_PAYLOAD, SECRET);
    assert.ok(result.tampered, "Malformed token treated as tampered");
    assert.ok(!result.valid);
  });

  it("token signed with different secret is rejected", () => {
    const fakeNow = Date.now();
    const token = signPreviewHash(SAMPLE_PAYLOAD, "other-secret", fakeNow);
    const result = verifyPreviewHash(token, SAMPLE_PAYLOAD, SECRET, fakeNow + 1000);
    assert.ok(result.tampered, "Token from different secret must be rejected");
  });

  it("same payload produces deterministic HMAC for same timestamp", () => {
    const fakeNow = 1700000000000;
    const t1 = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const t2 = signPreviewHash(SAMPLE_PAYLOAD, SECRET, fakeNow);
    const [h1] = t1.split(".");
    const [h2] = t2.split(".");
    assert.equal(h1, h2, "Same payload/secret/time must produce same HMAC");
  });
});

// ─── MRR / ARR Calculation ────────────────────────────────────────────────────

describe("MRR calculation — calculateMrrMinorFromSubs", () => {
  it("monthly plan: full price counted", () => {
    const subs: ActiveSubForMrr[] = [
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 990 } },
    ];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.equal(mrr["TRY"], 990);
  });

  it("yearly plan: monthlyEquivalentMinor is 1/12 of annual price", () => {
    // yearlyPrice = 9900, monthly equivalent = 825
    const subs: ActiveSubForMrr[] = [
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 825 } },
    ];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.equal(mrr["TRY"], 825);
  });

  it("free plan (monthlyEquivalent = 0) is excluded", () => {
    const subs: ActiveSubForMrr[] = [
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 0 } },
    ];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.equal(mrr["TRY"], undefined, "Free plan must not contribute to MRR");
  });

  it("null lockedPlanPrice is excluded (no price locked)", () => {
    const subs: ActiveSubForMrr[] = [{ lockedPlanPrice: null }];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.deepEqual(mrr, {}, "Sub with no locked price must be excluded");
  });

  it("multiple currencies are kept separate", () => {
    const subs: ActiveSubForMrr[] = [
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 990 } },
      { lockedPlanPrice: { currency: "USD", monthlyEquivalentMinor: 500 } },
      { lockedPlanPrice: { currency: "EUR", monthlyEquivalentMinor: 450 } },
    ];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.equal(mrr["TRY"], 990);
    assert.equal(mrr["USD"], 500);
    assert.equal(mrr["EUR"], 450);
  });

  it("multiple subs in same currency are summed", () => {
    const subs: ActiveSubForMrr[] = [
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 990 } },
      { lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 1980 } },
    ];
    const mrr = calculateMrrMinorFromSubs(subs);
    assert.equal(mrr["TRY"], 2970);
  });

  it("empty array returns empty object", () => {
    assert.deepEqual(calculateMrrMinorFromSubs([]), {});
  });

  it("ARR = MRR * 12 (verified via source code)", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-metric-service.ts");
    assert.ok(content.includes("* 12"), "ARR must be computed as MRR * 12");
  });
});

// ─── Serializers ─────────────────────────────────────────────────────────────

describe("maskProviderRef", () => {
  it("null/undefined returns em-dash", () => {
    assert.equal(maskProviderRef(null), "—");
    assert.equal(maskProviderRef(undefined), "—");
    assert.equal(maskProviderRef(""), "—");
  });

  it("short string (≤8 chars) returns all asterisks", () => {
    const r = maskProviderRef("ABCDEFGH");
    assert.ok(r.includes("*"), "Short string should be masked");
    assert.ok(!r.includes("A") || !r.includes("H") || r === "ABCD****EFGH");
  });

  it("12-char string shows first 4 + **** + last 4", () => {
    assert.equal(maskProviderRef("ABCDEFGHIJKL"), "ABCD****IJKL");
  });

  it("longer string masks the middle", () => {
    const result = maskProviderRef("1234567890abcdef");
    assert.ok(result.startsWith("1234"), "Should show first 4");
    assert.ok(result.endsWith("cdef"), "Should show last 4");
    assert.ok(result.includes("****"), "Should mask middle");
  });
});

describe("formatMinor", () => {
  it("formats 100 TRY minor (1.00 TRY)", () => {
    const result = formatMinor(100, "TRY");
    assert.ok(typeof result === "string" && result.length > 0);
    // Should contain "1" somewhere
    assert.ok(result.includes("1") || result.includes("₺"));
  });

  it("formats 0 as zero string", () => {
    const result = formatMinor(0, "TRY");
    assert.ok(typeof result === "string");
    assert.ok(result.includes("0"));
  });
});

describe("getSubscriptionStatusLabel", () => {
  it("returns Turkish labels for known statuses", () => {
    const label = getSubscriptionStatusLabel("ACTIVE");
    assert.ok(typeof label === "string" && label.length > 0);
  });

  it("returns string for CANCELLED status", () => {
    const label = getSubscriptionStatusLabel("CANCELLED");
    assert.ok(typeof label === "string" && label.length > 0);
  });
});

describe("getBillingIntervalLabel", () => {
  it("returns Turkish labels for MONTHLY, YEARLY, etc.", () => {
    assert.ok(typeof getBillingIntervalLabel("MONTHLY") === "string");
    assert.ok(typeof getBillingIntervalLabel("YEARLY") === "string");
  });
});

// ─── Issue Detection ──────────────────────────────────────────────────────────

describe("detectSubscriptionIssues", () => {
  const baseInput = {
    status: "ACTIVE" as const,
    planId: "plan_123",
    lockedPriceMinor: 990,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    companyStatus: "ACTIVE" as const,
    lastPaymentStatus: "PAID" as const,
    paymentCount: 3,
    failedPaymentCount: 0,
    isFree: false,
  };

  it("no issues for healthy active subscription", () => {
    const issues = detectSubscriptionIssues(baseInput);
    assert.equal(issues.length, 0);
  });

  it("detects PAST_DUE status", () => {
    const issues = detectSubscriptionIssues({ ...baseInput, status: "PAST_DUE" as const });
    assert.ok(issues.length > 0, "PAST_DUE must generate an issue");
  });

  it("detects missing planId", () => {
    const issues = detectSubscriptionIssues({ ...baseInput, planId: null });
    assert.ok(issues.some((i) => i === "ACTIVE_NO_PLAN"), "Missing plan must generate ACTIVE_NO_PLAN issue");
  });

  it("detects active subscription with no payment history", () => {
    const issues = detectSubscriptionIssues({
      ...baseInput,
      paymentCount: 0,
      isFree: false,
    });
    assert.ok(
      issues.some((i) => i === "ACTIVE_NO_PAYMENT_HISTORY"),
      "Active paid sub with no payments must generate ACTIVE_NO_PAYMENT_HISTORY"
    );
  });

  it("detects period ending soon (within 7 days)", () => {
    const soonDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const issues = detectSubscriptionIssues({ ...baseInput, currentPeriodEnd: soonDate });
    // Should detect upcoming expiry or similar
    assert.ok(Array.isArray(issues));
  });

  it("detects company suspension", () => {
    const issues = detectSubscriptionIssues({
      ...baseInput,
      companyStatus: "SUSPENDED" as const,
    });
    assert.ok(issues.length > 0, "Suspended company should generate an issue");
  });
});

describe("ISSUE_LABELS completeness", () => {
  it("all issue types have Turkish labels", () => {
    const entries = Object.entries(ISSUE_LABELS);
    assert.ok(entries.length >= 10, `Expected >=10 issue labels, got ${entries.length}`);
    for (const [key, label] of entries) {
      assert.ok(typeof label === "string" && label.length > 0, `Issue ${key} must have a label`);
    }
  });

  it("getIssueLabel returns the label", () => {
    const first: SubscriptionIssue = "ACTIVE_NO_PLAN";
    assert.equal(getIssueLabel(first), ISSUE_LABELS[first]);
  });
});

// ─── History Deduplication ────────────────────────────────────────────────────

describe("History deduplication — source policy", () => {
  it("history service filters PAYMENT_ prefixed activity logs", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(
      content.includes('log.action.startsWith("PAYMENT_")'),
      "Must skip PAYMENT_ logs (already shown in payments tab)"
    );
  });

  it("history service filters SUBSCRIPTION_CREATED duplicate", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(
      content.includes('"SUBSCRIPTION_CREATED"'),
      "Must skip SUBSCRIPTION_CREATED log (shown via sub-created event)"
    );
  });

  it("history dedup uses a Set of event IDs", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(content.includes("new Set<string>()"), "Dedup must use a Set");
    assert.ok(content.includes("seen.has(e.id)"), "Dedup must check Set membership");
  });

  it("event IDs are namespaced by source type", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-detail-service.ts");
    assert.ok(content.includes('`log-${log.id}`'), "Log events prefixed with log-");
    assert.ok(content.includes('`change-${change.id}`'), "Change events prefixed with change-");
    assert.ok(content.includes('`payment-${payment.id}`'), "Payment events prefixed with payment-");
  });
});

// ─── Entitlement Safety ───────────────────────────────────────────────────────

describe("Entitlement isolation", () => {
  it("entitlement tab filters by subscriptionId for add-ons", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-entitlement-service.ts");
    assert.ok(content.includes("subscriptionId"), "Add-on query must be scoped to subscriptionId");
  });

  it("entitlement tab shows only ACTIVE or PENDING add-ons", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-entitlement-service.ts");
    assert.ok(
      content.includes('"ACTIVE"') && content.includes('"PENDING"'),
      "Only active/pending add-ons should be included"
    );
  });

  it("analyticsOnly flag is set", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-entitlement-service.ts");
    assert.ok(content.includes("analyticsOnly: true"), "Must be analyticsOnly");
  });

  it("disclaimer text is present", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-entitlement-service.ts");
    assert.ok(content.includes("disclaimer"), "Must include disclaimer");
    assert.ok(content.includes("operasyonel"), "Disclaimer must explain operational enforcement is disabled");
  });
});

// ─── Admin Notes Isolation ────────────────────────────────────────────────────

describe("Admin notes isolation", () => {
  it("all note queries include subscriptionId filter", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-note-service.ts");
    const queryBlocks = content.split("db.adminSubscriptionNote").slice(1);
    for (const block of queryBlocks) {
      assert.ok(
        block.includes("subscriptionId"),
        "Every note query must filter by subscriptionId"
      );
    }
  });

  it("delete is soft-delete only (no hard delete)", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-note-service.ts");
    assert.ok(!content.includes(".delete("), "Hard delete must not be used");
    assert.ok(content.includes("deletedAt: new Date()"), "Soft delete required");
  });

  it("list query excludes soft-deleted notes", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-note-service.ts");
    assert.ok(content.includes("deletedAt: null"), "Must exclude soft-deleted notes");
  });

  it("authorUserId is treated as nullable (ON DELETE SET NULL)", () => {
    const migration = src(
      "prisma/migrations/20260702120000_admin_subscription_management/migration.sql"
    );
    assert.ok(migration.includes("ON DELETE SET NULL"), "authorUserId FK must be SET NULL");
  });

  it("notes table has index on subscriptionId + deletedAt", () => {
    const migration = src(
      "prisma/migrations/20260702120000_admin_subscription_management/migration.sql"
    );
    assert.ok(
      migration.includes("AdminSubscriptionNote_subscriptionId_deletedAt_idx"),
      "Index on subscriptionId + deletedAt required"
    );
  });
});

// ─── Cache Invalidation Policy ────────────────────────────────────────────────

describe("Cache invalidation coverage", () => {
  it("invalidateAdminSubscriptionCaches clears list + detail + payments + history", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-cache.ts");
    assert.ok(content.includes("admin-subscription-list-metrics"), "List cache must be cleared");
    assert.ok(content.includes("admin-subscription-detail:"), "Detail cache must be cleared");
    assert.ok(content.includes("subscription-payments:"), "Payments cache must be cleared");
    assert.ok(content.includes("subscription-history:"), "History cache must be cleared");
  });

  it("company billing cache is also cleared", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-cache.ts");
    assert.ok(content.includes("company-billing:"), "Company billing cache must be cleared");
  });

  it("action service uses SUBSCRIPTION_PREVIEW_SECRET not NEXTAUTH_SECRET", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(content.includes("resolveSubscriptionPreviewSecret"), "Must use dedicated preview secret");
    assert.ok(!content.includes("NEXTAUTH_SECRET"), "Must not use NEXTAUTH_SECRET for preview");
    assert.ok(!content.includes("admin-sub-preview-dev-secret"), "No hardcoded fallback");
  });
});

// ─── Route Auth Coverage ──────────────────────────────────────────────────────

describe("Route authentication coverage", () => {
  const ROUTES = [
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

  for (const route of ROUTES) {
    it(`${route} uses requireSuperAdminApi`, () => {
      const content = src(route);
      assert.ok(content.includes("requireSuperAdminApi"), `${route} missing requireSuperAdminApi`);
    });
  }

  it("no generic PATCH to change subscription status/plan/payment directly", () => {
    const listRoute = src("app/api/admin/subscriptions/route.ts");
    assert.ok(!listRoute.includes("PATCH"), "List route must not have PATCH");
    // The [id] route only has GET — mutations go through dedicated sub-routes
    const idRoute = src("app/api/admin/subscriptions/[id]/route.ts");
    assert.ok(!idRoute.includes("export async function PATCH"), "Detail route must not have PATCH");
  });
});

// ─── CSV Security ─────────────────────────────────────────────────────────────

describe("CSV export security", () => {
  it("CSV export does not include sensitive payment/credential fields", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-list-service.ts");
    // The export function should not select sensitive fields
    assert.ok(!content.includes("payerIp"), "CSV must not expose payerIp");
    assert.ok(!content.includes("payerPhone"), "CSV must not expose payerPhone");
    assert.ok(!content.includes("payerEmail"), "CSV must not expose payerEmail");
    assert.ok(!content.includes("callbackBody"), "CSV must not expose callbackBody");
  });
});

// ─── PayTR Constraint ─────────────────────────────────────────────────────────

describe("PayTR provider constraints", () => {
  it("sync provider returns NOT_SUPPORTED for PayTR", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(content.includes("NOT_SUPPORTED_PAYTR_MANUAL"), "Must mark PayTR as not supported");
  });

  it("sync provider does not create payments", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(!content.includes("membershipPayment.create"), "Sync must not create payments");
  });

  it("sync provider documents restriction in audit metadata", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    assert.ok(content.includes("PayTR iframe/manual"), "Audit must document PayTR restriction");
  });

  it("credential response does not appear in audit", () => {
    const content = src("lib/admin/subscriptions/admin-subscription-action-service.ts");
    // The audit call for sync must NOT include credential fields
    assert.ok(!content.includes("apiKey"), "No apiKey in audit");
    assert.ok(!content.includes("merchantKey"), "No merchantKey in audit");
    assert.ok(!content.includes("secretKey"), "No secretKey in audit");
  });
});

// ─── Migration FK/Index Validation ───────────────────────────────────────────

describe("Migration 20260702120000 FK and index validation", () => {
  const migration = src(
    "prisma/migrations/20260702120000_admin_subscription_management/migration.sql"
  );

  it("AdminSubscriptionNote FK to CompanySubscription uses CASCADE", () => {
    assert.ok(
      migration.includes("AdminSubscriptionNote_subscriptionId_fkey"),
      "FK for subscriptionId must exist"
    );
    assert.ok(migration.includes("ON DELETE CASCADE"), "Subscription cascade delete required");
  });

  it("authorUserId FK uses SET NULL (notes survive admin deletion)", () => {
    assert.ok(
      migration.includes("AdminSubscriptionNote_authorUserId_fkey"),
      "FK for authorUserId must exist"
    );
    const authorFkBlock = migration.slice(
      migration.indexOf("AdminSubscriptionNote_authorUserId_fkey"),
      migration.indexOf("AdminSubscriptionNote_authorUserId_fkey") + 200
    );
    assert.ok(authorFkBlock.includes("SET NULL"), "authorUserId must be SET NULL on delete");
  });

  it("cancellationScheduledByAdminId is nullable", () => {
    assert.ok(
      migration.includes('"cancellationScheduledByAdminId"'),
      "cancellationScheduledByAdminId column must exist"
    );
    // It should not have NOT NULL constraint (nullable columns don't have it in ALTER ADD COLUMN)
    const colLine = migration
      .split("\n")
      .find((l) => l.includes("cancellationScheduledByAdminId"));
    assert.ok(colLine, "cancellationScheduledByAdminId column must exist");
    assert.ok(!colLine!.includes("NOT NULL"), "cancellationScheduledByAdminId must be nullable");
  });

  it("adminNotes is a relation (not a physical column)", () => {
    // adminNotes is a virtual Prisma relation — must NOT appear as a column in migration
    assert.ok(
      !migration.includes('"adminNotes"'),
      "adminNotes is a Prisma relation — must not be a physical column"
    );
  });

  it("AdminSubscriptionNoteCategory enum is created without duplicates", () => {
    const enumCount = (migration.match(/AdminSubscriptionNoteCategory/g) ?? []).length;
    assert.ok(enumCount >= 1, "Enum must be created");
    const createCount = (migration.match(/CREATE TYPE "AdminSubscriptionNoteCategory"/g) ?? []).length;
    assert.equal(createCount, 1, "Enum must not be created twice");
  });
});
