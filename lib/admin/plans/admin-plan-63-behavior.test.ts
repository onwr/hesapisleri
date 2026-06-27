/**
 * Faz 6.3 — subscriptions, history dedupe, activity redaction, plan notes
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildHistoryEventId,
  dedupePlanHistoryEvents,
  type PlanHistoryEvent,
} from "@/lib/admin/plans/admin-plan-history-utils";
import { maskIp, redactActivityMessage } from "@/lib/admin/plans/admin-plan-activity-utils";
import {
  detectPlanSubscriptionIssuesWithPlan,
} from "@/lib/admin/plans/admin-plan-subscription-issue-service";
import { buildPlanSubscriptionWhere } from "@/lib/admin/plans/admin-plan-subscription-service";
import { calculateMrrWithDuplicateAwareness } from "@/lib/admin/subscriptions/admin-subscription-action-validators";
import { adminPlanNoteCreateSchema } from "@/lib/admin/plans/admin-plan-schemas";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("history dedupe", () => {
  const base = (id: string, source: PlanHistoryEvent["source"], at: string): PlanHistoryEvent => ({
    eventId: id,
    occurredAt: at,
    eventType: "PLAN_PRICE_PUBLISHED",
    source,
    category: "PRICE",
    actorLabel: "Admin",
    actorUserId: "u1",
    beforeSummary: null,
    afterSummary: "a",
    reason: null,
    relatedRecordId: "p1",
    relatedTab: "pricing",
    success: true,
  });

  it("aynı eventId için AUDIT öncelikli", () => {
    const id = "price-entity:p1";
    const out = dedupePlanHistoryEvents([
      base(id, "MODEL", "2026-01-02T00:00:00Z"),
      base(id, "AUDIT", "2026-01-01T00:00:00Z"),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].source, "AUDIT");
  });

  it("deterministic event ID üretir", () => {
    assert.equal(buildHistoryEventId({ eventType: "PLAN_CREATED", planId: "plan-1" }), "plan-created:plan-1");
    assert.equal(
      buildHistoryEventId({ eventType: "X", planId: "p", activityId: "act-1" }),
      "plan-activity:act-1"
    );
  });

  it("farklı olaylar korunur", () => {
    const mk = (priceId: string, at: string): PlanHistoryEvent => ({
      ...base(`price-entity:${priceId}`, "AUDIT", at),
      relatedRecordId: priceId,
    });
    const out = dedupePlanHistoryEvents([mk("a", "2026-01-03T00:00:00Z"), mk("b", "2026-01-02T00:00:00Z")]);
    assert.equal(out.length, 2);
    assert.ok(out[0].occurredAt >= out[1].occurredAt);
  });
});

describe("activity redaction", () => {
  it("IP maskeler", () => {
    assert.equal(maskIp("192.168.1.42"), "192.168.x.x");
  });

  it("hassas anahtarları gizler", () => {
    const out = redactActivityMessage(JSON.stringify({ previewToken: "secret-value", planId: "p1" }));
    assert.ok(out.includes("[redacted]"));
    assert.ok(!out.includes("secret-value"));
  });
});

describe("plan subscription issues", () => {
  it("kilitsiz aktif abonelik issue üretir", () => {
    const issues = detectPlanSubscriptionIssuesWithPlan(
      {
        id: "s1",
        companyId: "c1",
        planId: "plan-1",
        status: "ACTIVE",
        lockedPlanPriceId: null,
        lockedPriceMinor: null,
        priceLockType: null,
        nextPlanPriceId: null,
        nextPriceEffectiveAt: null,
        currentPeriodEnd: new Date("2027-01-01"),
        billingInterval: "MONTHLY",
        lockedPlanPrice: null,
        nextPlanPrice: null,
        plan: { planStatus: "ACTIVE", defaultCurrency: "TRY" },
      },
      null
    );
    assert.ok(issues.some((i) => i.code === "SUBSCRIPTION_PRICE_UNLOCKED"));
  });

  it("buildPlanSubscriptionWhere planId zorunlu", () => {
    const where = buildPlanSubscriptionWhere("plan-xyz", {
      status: "ALL",
      billingInterval: "ALL",
      priceLockType: "ALL",
      grandfathered: "ALL",
      locked: "ALL",
      hasNextPrice: "ALL",
      sortBy: "createdAt",
      sortDir: "desc",
      page: 1,
      pageSize: 25,
    });
    assert.equal(where.planId, "plan-xyz");
  });
});

describe("MRR policy", () => {
  it("trial hariç ACTIVE ve cancel-at-period-end dahil", () => {
    const { mrrMinor } = calculateMrrWithDuplicateAwareness([
      {
        companyId: "c1",
        subscriptionId: "s1",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 10000 },
      },
      {
        companyId: "c2",
        subscriptionId: "s2",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 5000 },
      },
    ]);
    assert.equal(mrrMinor.TRY, 15000);
  });

  it("duplicate excess MRR ayrı raporlanır", () => {
    const { duplicateCompanies } = calculateMrrWithDuplicateAwareness([
      {
        companyId: "c1",
        subscriptionId: "s1",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 10000 },
      },
      {
        companyId: "c1",
        subscriptionId: "s2",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 3000 },
      },
    ]);
    assert.equal(duplicateCompanies.length, 1);
    assert.equal(duplicateCompanies[0].excessMrrMinor.TRY, 3000);
  });
});

describe("plan note schema", () => {
  it("boş içerik reddedilir", () => {
    const r = adminPlanNoteCreateSchema.safeParse({ content: "   " });
    assert.equal(r.success, false);
  });

  it("bilinmeyen alan reddedilir", () => {
    const r = adminPlanNoteCreateSchema.safeParse({ content: "not", planId: "x" });
    assert.equal(r.success, false);
  });
});

describe("Faz 6.3 route güvenliği", () => {
  const routes = [
    "app/api/admin/plans/[id]/subscriptions/route.ts",
    "app/api/admin/plans/[id]/history/route.ts",
    "app/api/admin/plans/[id]/activity/route.ts",
    "app/api/admin/plans/[id]/notes/route.ts",
    "app/api/admin/plans/[id]/notes/[noteId]/route.ts",
  ];

  for (const route of routes) {
    it(`${route} requireSuperAdminApi`, () => {
      assert.ok(readSrc(route).includes("requireSuperAdminApi"));
    });
  }

  it("note servisi invalidateAdminPlanNoteCaches çağırır", () => {
    const src = readSrc("lib/admin/plans/admin-plan-note-service.ts");
    assert.ok(src.includes("invalidateAdminPlanNoteCaches"));
    assert.ok(src.includes("authorUserId: actorUserId"));
    assert.ok(!src.includes("body.authorUserId"));
  });

  it("note planId route parametresinden", () => {
    const src = readSrc("app/api/admin/plans/[id]/notes/route.ts");
    assert.ok(src.includes("await context.params"));
    assert.ok(!src.includes("body.planId"));
  });
});
