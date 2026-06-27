/**
 * Faz 6.4 — plan create wizard + clone isolation
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminPlanCreateSchema,
  adminPlanCloneSchema,
  assertNoForbiddenPlanCreateKeys,
} from "@/lib/admin/plans/admin-plan-schemas";
import {
  normalizePlanCode,
  RESERVED_PLAN_CODES,
} from "@/lib/admin/plans/admin-plan-code-utils";
import {
  mapClonedPriceRow,
  pickPricesToClone,
  CLONE_EXCLUDED_RELATIONS,
} from "@/lib/admin/plans/admin-plan-clone-utils";
import {
  getExistingCreatePlanId,
  recordCreatePlanIdempotency,
  resetCreatePlanIdempotencyForTests,
} from "@/lib/admin/plans/admin-plan-create-idempotency";
import {
  assertValidEntitlementSet,
  validateEntitlementSet,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import { isPlanCheckoutAvailable } from "@/lib/admin/plans/admin-plan-checkout-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("plan code security", () => {
  it("normalize trim ve küçük harf", () => {
    assert.equal(normalizePlanCode("  Pro-Plan  "), "pro-plan");
  });

  it("standard reserved", () => {
    assert.ok(RESERVED_PLAN_CODES.has("standard"));
  });
});

describe("create schema strict", () => {
  it("draft create body geçerli", () => {
    const r = adminPlanCreateSchema.safeParse({
      name: "Test Plan",
      code: "test-plan",
      sortOrder: 100,
      trialEnabled: true,
      trialDays: 14,
      defaultCurrency: "TRY",
      visibility: "INTERNAL",
      features: [{ title: "Özellik 1", sortOrder: 10 }],
      entitlements: [],
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.name, "Test Plan");
      assert.equal(r.data.features.length, 1);
    }
  });

  it("client planStatus reddedilir", () => {
    const r = adminPlanCreateSchema.safeParse({
      name: "X",
      code: "x-plan",
      planStatus: "ACTIVE",
    });
    assert.equal(r.success, false);
  });

  it("client isActive reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPlanCreateKeys({
        name: "X",
        code: "x",
        isActive: true,
      })
    );
  });

  it("legacy fiyat kolonları reddedilir", () => {
    assert.throws(() =>
      assertNoForbiddenPlanCreateKeys({
        name: "X",
        code: "x",
        monthlyPrice: 100,
      })
    );
  });

  it("bilinmeyen alan strict reddedilir", () => {
    const r = adminPlanCreateSchema.safeParse({
      name: "X",
      code: "x-plan",
      planId: "evil",
    });
    assert.equal(r.success, false);
  });
});

describe("entitlement registry validation on create", () => {
  it("bilinmeyen kod hata üretir — transaction öncesi", () => {
    const issues = validateEntitlementSet([
      {
        code: "NOT_A_REAL_ENTITLEMENT_CODE_XYZ",
        valueType: "BOOLEAN",
        booleanValue: true,
      },
    ]);
    assert.ok(issues.some((i) => i.severity === "error"));
    assert.throws(() =>
      assertValidEntitlementSet([
        {
          code: "NOT_A_REAL_ENTITLEMENT_CODE_XYZ",
          valueType: "BOOLEAN",
          booleanValue: true,
        },
      ])
    );
  });

  it("registry kodu kabul edilir", () => {
    assert.doesNotThrow(() =>
      assertValidEntitlementSet([
        {
          code: "DASHBOARD",
          valueType: "BOOLEAN",
          booleanValue: true,
        },
      ])
    );
  });
});

describe("clone price mapping", () => {
  const source = {
    billingInterval: "MONTHLY" as const,
    listPriceMinor: 10000,
    salePriceMinor: 9900,
    currency: "TRY",
    vatRate: 20,
    vatIncluded: false,
    monthlyEquivalentMinor: 9900,
    isAutoRenewEnabled: true,
    sortOrder: 100,
    priceChangePolicy: "NEW_SUBSCRIBERS_ONLY" as const,
    adminNote: null,
    id: "price-1",
    planId: "source-plan",
    version: 3,
    status: "ACTIVE" as const,
    effectiveFrom: new Date("2020-01-01"),
    effectiveUntil: null,
    isPublic: true,
    publishedAt: new Date("2020-01-02"),
    publishedByUserId: "u1",
    createdByUserId: "u1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("cloned price DRAFT ve private", () => {
    const mapped = mapClonedPriceRow(source, "new-plan", "admin-1");
    assert.equal(mapped.status, "DRAFT");
    assert.equal(mapped.isPublic, false);
    assert.equal(mapped.planId, "new-plan");
    assert.equal(mapped.version, 1);
    assert.equal(mapped.publishedAt, null);
    assert.equal(mapped.publishedByUserId, null);
    assert.equal(mapped.effectiveUntil, null);
  });

  it("pickPricesToClone interval başına tek kayıt", () => {
    const p2 = { ...source, id: "p2", billingInterval: "YEARLY" as const, version: 1 };
    const p3 = { ...source, id: "p3", version: 2 };
    const picked = pickPricesToClone([source, p2, p3]);
    assert.equal(picked.length, 2);
    assert.equal(picked.find((p) => p.billingInterval === "MONTHLY")?.version, 3);
  });
});

describe("cloned plan checkout kapalı", () => {
  it("DRAFT INTERNAL non-standard checkout yok", () => {
    assert.equal(
      isPlanCheckoutAvailable({
        planStatus: "DRAFT",
        visibility: "INTERNAL",
        code: "my-clone",
        pricingClass: "PAID",
        hasPriceConflicts: false,
      }),
      false
    );
  });
});

describe("clone schema", () => {
  it("confirm zorunlu", () => {
    const r = adminPlanCloneSchema.safeParse({
      name: "Kopya",
      code: "kopya-plan",
      reason: "test",
      confirm: false,
    });
    assert.equal(r.success, false);
  });

  it("geçerli clone body", () => {
    const r = adminPlanCloneSchema.safeParse({
      name: "Kopya",
      code: "kopya-plan",
      copyFeatures: true,
      copyEntitlements: false,
      copyPricesAsDraft: true,
      reason: "Yeni segment",
      confirm: true,
    });
    assert.equal(r.success, true);
  });
});

describe("create idempotency", () => {
  it("aynı clientRequestId aynı planId döner", () => {
    resetCreatePlanIdempotencyForTests();
    recordCreatePlanIdempotency("req-abc", "plan-123");
    assert.equal(getExistingCreatePlanId("req-abc"), "plan-123");
    assert.equal(getExistingCreatePlanId("other"), null);
    resetCreatePlanIdempotencyForTests();
  });
});

describe("clone isolation contract", () => {
  it("kopyalanmayan ilişkiler tanımlı", () => {
    assert.ok(CLONE_EXCLUDED_RELATIONS.includes("CompanySubscription"));
    assert.ok(CLONE_EXCLUDED_RELATIONS.includes("MembershipPayment"));
    assert.ok(CLONE_EXCLUDED_RELATIONS.includes("AdminPlanNote"));
    assert.ok(CLONE_EXCLUDED_RELATIONS.includes("ActivityLog"));
  });

  it("clone servisi subscription/payment kopyalamaz", () => {
    const src = readSrc("lib/admin/plans/admin-plan-clone-service.ts");
    assert.ok(!src.includes("companySubscription.create"));
    assert.ok(!src.includes("membershipPayment.create"));
    assert.ok(!src.includes("adminPlanNote.create"));
    assert.ok(!src.includes("activityLog.create"));
    assert.ok(src.includes('action: "PLAN_CLONED"'));
    assert.ok(src.includes("sourcePlanId"));
    assert.ok(src.includes("clonedPlanId"));
  });
});

describe("structured audit writers", () => {
  it("create servisi PLAN_CREATED audit", () => {
    const src = readSrc("lib/admin/plans/admin-plan-create-service.ts");
    assert.ok(src.includes('action: "PLAN_CREATED"'));
    assert.ok(src.includes('entityType: "MembershipPlan"'));
    assert.ok(src.includes("planStatus: \"DRAFT\""));
    assert.ok(src.includes("isActive: false"));
    assert.ok(src.includes("syncLegacyPlanFeatures"));
    assert.ok(src.includes("invalidateAdminPlanCaches"));
  });

  it("patch servisi PLAN_UPDATED audit", () => {
    const src = readSrc("lib/admin/plans/admin-plan-patch-service.ts");
    assert.ok(src.includes('action: "PLAN_UPDATED"'));
  });
});

describe("Faz 6.4 route auth", () => {
  it("POST /api/admin/plans requireSuperAdminApi", () => {
    assert.ok(readSrc("app/api/admin/plans/route.ts").includes("requireSuperAdminApi"));
    assert.ok(readSrc("app/api/admin/plans/route.ts").includes("createAdminPlanDraft"));
  });

  it("POST clone requireSuperAdminApi", () => {
    assert.ok(readSrc("app/api/admin/plans/[id]/clone/route.ts").includes("requireSuperAdminApi"));
  });

  it("tenant admin SUPER_ADMIN kontrolü", () => {
    const auth = readSrc("lib/admin-auth.ts");
    assert.ok(auth.includes("isPlatformSuperAdminUser"));
  });
});

describe("UI entry points", () => {
  it("/admin/plans/new sayfası", () => {
    assert.ok(readSrc("app/admin/plans/new/page.tsx").includes("AdminPlanCreateWizard"));
  });

  it("list Yeni Plan linki", () => {
    assert.ok(readSrc("app/admin/plans/page.tsx").includes("/admin/plans/new"));
  });

  it("detail Planı Kopyala", () => {
    assert.ok(readSrc("components/admin/plans/admin-plan-detail-shell.tsx").includes("Planı Kopyala"));
    assert.ok(readSrc("components/admin/plans/admin-plan-detail-shell.tsx").includes("AdminPlanCloneModal"));
  });
});
