/**
 * Faz 6.3.1 — activity plan isolation, MRR resolution, history dedupe, recursive redaction
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  belongsToPlanActivity,
  filterLogsForPlan,
  matchesLegacyInferredPlanScope,
  matchesStructuredPlanScope,
  redactValueRecursive,
  maskIp,
  type ActivityLogScopeRow,
} from "@/lib/admin/plans/admin-plan-activity-scope";
import {
  resolveMrrMonthlyMinor,
  buildMrrSubInput,
  isMrrEligibleStatus,
} from "@/lib/admin/plans/admin-plan-mrr-resolution";
import {
  dedupePlanHistoryEvents,
  historyDedupeKey,
  type PlanHistoryEvent,
} from "@/lib/admin/plans/admin-plan-history-utils";
import { pickTabPage } from "@/lib/admin/plans/admin-plan-tab-query-utils";
import { calculateMrrWithDuplicateAwareness } from "@/lib/admin/subscriptions/admin-subscription-action-validators";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function row(partial: Partial<ActivityLogScopeRow> & Pick<ActivityLogScopeRow, "id" | "action">): ActivityLogScopeRow {
  return {
    module: "admin-plans",
    message: null,
    entityType: null,
    entityId: null,
    metadata: null,
    ...partial,
  };
}

const PLAN_A = "clplanaaaaaaaaaaaaaa";
const PLAN_B = "clplanbbbbbbbbbbbbbb";
const PLAN_A_PREFIX = "clplanaaaa";

describe("activity plan isolation", () => {
  it("Plan A listesinde Plan B structured kaydı görünmez", () => {
    const logs = [
      row({
        id: "1",
        action: "PLAN_UPDATED",
        entityType: "MembershipPlan",
        entityId: PLAN_B,
        metadata: { planId: PLAN_B },
      }),
      row({
        id: "2",
        action: "PLAN_FEATURE_CREATED",
        entityType: "PlanFeature",
        entityId: "feat-1",
        metadata: { planId: PLAN_A },
      }),
    ];
    const scoped = filterLogsForPlan(logs, PLAN_A);
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0].id, "2");
  });

  it("message içinde planId geçen unrelated kayıt görünmez", () => {
    const unrelated = row({
      id: "u1",
      action: "OTHER",
      message: `Referans metni ${PLAN_A} içeriyor ama JSON değil`,
    });
    assert.equal(matchesLegacyInferredPlanScope(unrelated, PLAN_A), false);
    assert.equal(belongsToPlanActivity(unrelated, PLAN_A), false);
  });

  it("aynı prefix iki plan ID karışmaz", () => {
    const collision = row({
      id: "c1",
      action: "PLAN_UPDATED",
      message: JSON.stringify({ planId: PLAN_A_PREFIX }),
    });
    assert.equal(belongsToPlanActivity(collision, PLAN_A), false);
    assert.equal(belongsToPlanActivity(collision, PLAN_A_PREFIX), true);
  });

  it("legacy JSON message planId ile bağlanır (metadata kolonu yok)", () => {
    const legacy = row({
      id: "leg1",
      action: "PLAN_PRICE_PUBLISHED",
      message: JSON.stringify({ planId: PLAN_A, priceId: "price-1" }),
    });
    assert.equal(belongsToPlanActivity(legacy, PLAN_A), true);
    assert.equal(belongsToPlanActivity(legacy, PLAN_B), false);
    assert.equal(matchesLegacyInferredPlanScope(legacy, PLAN_A), false);
  });

  it("structured metadata.planId ile feature kaydı bağlanır", () => {
    const feature = row({
      id: "f1",
      action: "PLAN_FEATURE_UPDATED",
      entityType: "PlanFeature",
      entityId: "feat-x",
      metadata: { planId: PLAN_A, featureId: "feat-x" },
    });
    assert.equal(matchesStructuredPlanScope(feature, PLAN_A), true);
    assert.equal(matchesStructuredPlanScope(feature, PLAN_B), false);
  });

  it("history/activity servisleri message contains kullanmaz", () => {
    const activitySrc = readSrc("lib/admin/plans/admin-plan-activity-service.ts");
    const historySrc = readSrc("lib/admin/plans/admin-plan-history-service.ts");
    assert.ok(!activitySrc.includes("contains: planId"));
    assert.ok(!historySrc.includes("contains: planId"));
    assert.ok(!activitySrc.includes("message: { contains"));
    assert.ok(!historySrc.includes("message: { contains"));
  });
});

describe("MRR price resolution", () => {
  const base = {
    subscriptionId: "sub-1",
    status: "ACTIVE" as const,
    billingInterval: "MONTHLY" as const,
    lockedPriceMinor: null as number | null,
    lockedListPriceMinor: null as number | null,
    lockedPlanPriceId: null as string | null,
    lockedPlanPrice: null,
    paymentSnapshot: null,
    resolver: null,
  };

  it("lockedPriceMinor MRR (aylık)", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedPriceMinor: 120000,
      billingInterval: "YEARLY",
    });
    assert.equal(r.source, "locked_price_minor");
    assert.equal(r.monthlyMinor, 10000);
    assert.equal(r.unresolved, false);
  });

  it("lockedPlanPrice monthlyEquivalentMinor", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedPriceMinor: null,
      lockedPlanPrice: {
        id: "p1",
        currency: "TRY",
        monthlyEquivalentMinor: 9900,
        billingInterval: "MONTHLY",
        status: "ACTIVE",
      },
    });
    assert.equal(r.source, "locked_plan_price");
    assert.equal(r.monthlyMinor, 9900);
  });

  it("lockedPlanPriceId var kayıt yok → unresolved", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedPlanPriceId: "missing-price",
      lockedPriceMinor: null,
    });
    assert.equal(r.unresolved, true);
    assert.equal(r.source, "unresolved");
    assert.equal(r.monthlyMinor, null);
  });

  it("subscription snapshot fallback (lockedListPriceMinor)", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedListPriceMinor: 30000,
      billingInterval: "QUARTERLY",
    });
    assert.equal(r.source, "subscription_snapshot");
    assert.equal(r.monthlyMinor, 10000);
  });

  it("payment snapshot fallback", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedPriceMinor: null,
      paymentSnapshot: {
        subscriptionId: "sub-1",
        amountMinor: 60000,
        currency: "EUR",
        billingPeriodSnapshot: "SEMI_ANNUAL",
        periodMonthsSnapshot: 6,
        monthlyEquivalentMinor: null,
      },
    });
    assert.equal(r.source, "payment_snapshot");
    assert.equal(r.monthlyMinor, 10000);
    assert.equal(r.currency, "EUR");
  });

  it("farklı subscription payment snapshot kullanılmaz", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      paymentSnapshot: {
        subscriptionId: "other-sub",
        amountMinor: 50000,
        currency: "TRY",
        billingPeriodSnapshot: "MONTHLY",
        periodMonthsSnapshot: 1,
        monthlyEquivalentMinor: null,
      },
    });
    assert.equal(r.unresolved, true);
    assert.equal(buildMrrSubInput({ ...base, companyId: "c1" }, r), null);
  });

  it("resolver conflict → unresolved", () => {
    const r = resolveMrrMonthlyMinor({
      ...base,
      lockedPriceMinor: null,
      resolver: {
        monthlyEquivalentMinor: 5000,
        currency: "TRY",
        billingInterval: "MONTHLY",
        hasConflict: true,
        isRenewalSemantic: true,
      },
    });
    assert.equal(r.unresolved, true);
  });

  it("fiyat bulunamadı → unresolved, MRR toplamına alınmaz", () => {
    const r = resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: null });
    assert.equal(r.unresolved, true);
    const built = buildMrrSubInput({ ...base, companyId: "c1" }, r);
    assert.equal(built, null);
    const { mrrMinor } = calculateMrrWithDuplicateAwareness([]);
    assert.equal(mrrMinor.TRY ?? 0, 0);
  });

  it("TRIAL MRR dışı", () => {
    assert.equal(isMrrEligibleStatus("TRIAL"), false);
    const r = resolveMrrMonthlyMinor({
      ...base,
      status: "TRIAL",
      lockedPriceMinor: 10000,
    });
    assert.equal(r.countsForMrr, false);
  });

  it("ACTIVE ve CANCEL_AT_PERIOD_END dahil", () => {
    assert.equal(isMrrEligibleStatus("ACTIVE"), true);
    assert.equal(isMrrEligibleStatus("CANCEL_AT_PERIOD_END"), true);
  });

  it("CANCELLED/EXPIRED hariç", () => {
    for (const status of ["CANCELLED", "EXPIRED", "PAST_DUE"]) {
      const r = resolveMrrMonthlyMinor({
        ...base,
        status,
        lockedPriceMinor: 10000,
      });
      assert.equal(r.countsForMrr, false, status);
    }
  });

  it("yıllık /12, quarterly /3, semi-annual /6", () => {
    assert.equal(
      resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: 120000, billingInterval: "YEARLY" }).monthlyMinor,
      10000
    );
    assert.equal(
      resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: 30000, billingInterval: "QUARTERLY" }).monthlyMinor,
      10000
    );
    assert.equal(
      resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: 60000, billingInterval: "SEMI_ANNUAL" }).monthlyMinor,
      10000
    );
  });

  it("TRY/USD/EUR ayrı para birimlerinde toplanır", () => {
    const { mrrMinor } = calculateMrrWithDuplicateAwareness([
      {
        companyId: "c1",
        subscriptionId: "s1",
        lockedPlanPrice: { currency: "TRY", monthlyEquivalentMinor: 1000 },
      },
      {
        companyId: "c2",
        subscriptionId: "s2",
        lockedPlanPrice: { currency: "USD", monthlyEquivalentMinor: 2000 },
      },
      {
        companyId: "c3",
        subscriptionId: "s3",
        lockedPlanPrice: { currency: "EUR", monthlyEquivalentMinor: 3000 },
      },
    ]);
    assert.equal(mrrMinor.TRY, 1000);
    assert.equal(mrrMinor.USD, 2000);
    assert.equal(mrrMinor.EUR, 3000);
  });

  it("unresolved kayıt finansal toplamı şişirmez", () => {
    const resolved = resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: 10000 });
    const unresolved = resolveMrrMonthlyMinor({ ...base, lockedPriceMinor: null });
    const inputs = [
      buildMrrSubInput({ ...base, companyId: "c1" }, resolved),
      buildMrrSubInput({ ...base, companyId: "c2", subscriptionId: "sub-2" }, unresolved),
    ].filter((x): x is NonNullable<typeof x> => x != null);
    assert.equal(inputs.length, 1);
    const { mrrMinor } = calculateMrrWithDuplicateAwareness(inputs);
    assert.equal(mrrMinor.TRY, 10000);
  });
});

describe("history dedupe by entity relation", () => {
  const priceAudit = (priceId: string): PlanHistoryEvent => ({
    eventId: `price-entity:${priceId}`,
    occurredAt: "2026-06-01T10:00:00Z",
    eventType: "PLAN_PRICE_PUBLISHED",
    source: "AUDIT",
    category: "PRICE",
    actorLabel: "Admin",
    actorUserId: "u1",
    beforeSummary: null,
    afterSummary: "published",
    reason: null,
    relatedRecordId: priceId,
    relatedTab: "pricing",
    success: true,
  });

  const priceModel = (priceId: string): PlanHistoryEvent => ({
    eventId: `price:${priceId}:PLAN_PRICE_CREATED`,
    occurredAt: "2026-06-01T09:00:00Z",
    eventType: "PLAN_PRICE_CREATED",
    source: "MODEL",
    category: "PRICE",
    actorLabel: "Sistem",
    actorUserId: null,
    beforeSummary: null,
    afterSummary: "created",
    reason: null,
    relatedRecordId: priceId,
    relatedTab: "pricing",
    success: true,
  });

  it("price publish audit + model tek olay", () => {
    const out = dedupePlanHistoryEvents([priceModel("p1"), priceAudit("p1")]);
    assert.equal(out.length, 1);
    assert.equal(out[0].source, "AUDIT");
    assert.equal(historyDedupeKey(out[0]), "price-entity:p1");
  });

  it("feature update ve reorder ayrı olaylar", () => {
    const update: PlanHistoryEvent = {
      eventId: "feature-entity:f1:PLAN_FEATURE_UPDATED",
      occurredAt: "2026-06-02T00:00:00Z",
      eventType: "PLAN_FEATURE_UPDATED",
      source: "AUDIT",
      category: "FEATURE",
      actorLabel: "A",
      actorUserId: "u1",
      beforeSummary: null,
      afterSummary: null,
      reason: null,
      relatedRecordId: "f1",
      relatedTab: "features",
      success: true,
    };
    const reorder: PlanHistoryEvent = {
      ...update,
      eventId: "feature-entity:f1:PLAN_FEATURE_REORDERED",
      eventType: "PLAN_FEATURE_REORDERED",
      occurredAt: "2026-06-03T00:00:00Z",
    };
    assert.equal(dedupePlanHistoryEvents([update, reorder]).length, 2);
  });

  it("iki farklı note update korunur", () => {
    const n1: PlanHistoryEvent = {
      eventId: "note:n1:ADMIN_PLAN_NOTE_UPDATED",
      occurredAt: "2026-06-01T00:00:00Z",
      eventType: "ADMIN_PLAN_NOTE_UPDATED",
      source: "AUDIT",
      category: "NOTE",
      actorLabel: "A",
      actorUserId: "u1",
      beforeSummary: null,
      afterSummary: "a",
      reason: null,
      relatedRecordId: "n1",
      relatedTab: "notes",
      success: true,
    };
    const n2 = { ...n1, eventId: "note:n2:ADMIN_PLAN_NOTE_UPDATED", relatedRecordId: "n2", occurredAt: "2026-06-02T00:00:00Z" };
    assert.equal(dedupePlanHistoryEvents([n1, n2]).length, 2);
  });

  it("stable pagination sıralaması", () => {
    const events = dedupePlanHistoryEvents([
      priceAudit("p2"),
      priceAudit("p1"),
    ]);
    assert.ok(events[0].occurredAt >= events[1].occurredAt);
  });
});

describe("recursive metadata redaction", () => {
  it("iç içe metadata.secret", () => {
    const out = redactValueRecursive({ outer: { secret: "x" } }) as Record<string, unknown>;
    assert.deepEqual((out.outer as Record<string, unknown>).secret, "[redacted]");
  });

  it("metadata.headers.authorization", () => {
    const out = redactValueRecursive({ headers: { authorization: "Bearer tok" } }) as Record<string, unknown>;
    assert.deepEqual((out.headers as Record<string, unknown>).authorization, "[redacted]");
  });

  it("metadata.previewToken", () => {
    const out = redactValueRecursive({ previewToken: "abc" });
    assert.deepEqual(out, { previewToken: "[redacted]" });
  });

  it("array içindeki hassas obje", () => {
    const out = redactValueRecursive([{ password: "p" }, { planId: "ok" }]) as unknown[];
    assert.deepEqual((out[0] as Record<string, unknown>).password, "[redacted]");
    assert.deepEqual((out[1] as Record<string, unknown>).planId, "ok");
  });

  it("tam IP maskeleme", () => {
    assert.equal(maskIp("10.20.30.40"), "10.20.x.x");
  });
});

describe("tab pagination isolation", () => {
  it("subscriptionsPage diğer tab page'den öncelikli", () => {
    assert.equal(
      pickTabPage({ subscriptionsPage: "3", historyPage: "1", activityPage: "2", page: "9" }, "subscriptions"),
      3
    );
    assert.equal(pickTabPage({ historyPage: "4", page: "9" }, "history"), 4);
    assert.equal(pickTabPage({ activityPage: "5", page: "9" }, "activity"), 5);
  });

  it("invalid page normalize", () => {
    assert.equal(pickTabPage({ subscriptionsPage: "-1", page: "0" }, "subscriptions"), 1);
  });
});

describe("note plan isolation (service contract)", () => {
  it("listAdminPlanNotes planId ile scope edilir", () => {
    const src = readSrc("lib/admin/plans/admin-plan-note-service.ts");
    assert.ok(src.includes("where: { planId, deletedAt: null }"));
  });

  it("mutation planId route ile doğrulanır", () => {
    const src = readSrc("lib/admin/plans/admin-plan-note-service.ts");
    assert.ok(src.includes("where: { id: noteId, planId, deletedAt: null }"));
    assert.ok(src.includes("authorUserId: actorUserId"));
    assert.ok(src.includes("invalidateAdminPlanNoteCaches"));
  });
});

describe("Faz 6.3.1 route auth matrix", () => {
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

  it("tenant admin SUPER_ADMIN kontrolü ile reddedilir", () => {
    const auth = readSrc("lib/admin-auth.ts");
    assert.ok(auth.includes("SUPER_ADMIN"));
    assert.ok(auth.includes("isPlatformSuperAdminUser"));
  });
});

describe("structured audit writers", () => {
  it("logAdminPlanAudit entityType/entityId/metadata.planId yazar", () => {
    const src = readSrc("lib/admin/plans/admin-plan-audit-service.ts");
    assert.ok(src.includes("entityType: input.entityType"));
    assert.ok(src.includes("entityId: input.entityId"));
    assert.ok(src.includes("metadata:"));
    assert.ok(src.includes("planId"));
  });
});
