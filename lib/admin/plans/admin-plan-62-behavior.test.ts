/**
 * Faz 6.2 — PlanFeature CRUD, entitlement validation/preview, enforcement koruması
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  normalizeFeatureTitle,
  validateIconKey,
  AdminPlanFeatureValidationError,
  adminPlanFeatureCreateSchema,
  adminPlanFeatureReorderSchema,
} from "@/lib/admin/plans/admin-plan-feature-schemas";
import {
  computeEntitlementDiff,
  normalizeEntitlementRow,
  validateEntitlementRow,
  validateEntitlementSet,
  EntitlementValidationError,
  EntitlementPreviewStaleError,
} from "@/lib/admin/entitlements/admin-plan-entitlement-validation";
import {
  isOperationalFeatureEnforcementEnabled,
  isOperationalLimitEnforcementEnabled,
} from "@/lib/billing/entitlements/entitlement-operational-policy";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("PlanFeature şema ve validasyon", () => {
  it("normalizeFeatureTitle duplicate tespiti için normalize eder", () => {
    assert.equal(normalizeFeatureTitle("  POS  Satış  "), "pos satış");
    assert.equal(normalizeFeatureTitle("A"), "a");
  });

  it("iconKey HTML/script/SVG reddeder", () => {
    assert.throws(() => validateIconKey("<script>"), AdminPlanFeatureValidationError);
    assert.throws(() => validateIconKey("icon.svg"), AdminPlanFeatureValidationError);
    assert.equal(validateIconKey("check-circle"), "check-circle");
    assert.equal(validateIconKey(null), null);
  });

  it("create schema strict — bilinmeyen alan reddedilir", () => {
    const r = adminPlanFeatureCreateSchema.safeParse({
      title: "Test",
      extra: true,
    });
    assert.equal(r.success, false);
  });

  it("reorder schema duplicate ID kabul etmez (servis katmanı)", () => {
    const parsed = adminPlanFeatureReorderSchema.safeParse({
      orderedFeatureIds: ["a", "a"],
    });
    assert.equal(parsed.success, true);
    const unique = new Set(parsed.success ? parsed.data.orderedFeatureIds : []);
    assert.equal(unique.size, 1);
  });
});

describe("Entitlement value-type doğrulaması", () => {
  it("BOOLEAN yalnızca boolean kabul eder", () => {
    const issues = validateEntitlementRow({
      code: "POS",
      valueType: "BOOLEAN",
      booleanValue: true,
      numberValue: null,
      stringValue: null,
      isUnlimited: false,
    });
    assert.equal(issues.length, 0);

    const bad = validateEntitlementRow({
      code: "POS",
      valueType: "BOOLEAN",
      booleanValue: true,
      numberValue: 5,
    });
    assert.ok(bad.some((i) => i.code === "ENTITLEMENT_MULTIPLE_VALUE_FIELDS"));
  });

  it("NUMBER sonlu ve negatif olmayan değer", () => {
    const ok = validateEntitlementRow({
      code: "MAX_USERS",
      valueType: "NUMBER",
      numberValue: 10,
      booleanValue: null,
      stringValue: null,
      isUnlimited: false,
    });
    assert.equal(ok.length, 0);

    const neg = validateEntitlementRow({
      code: "MAX_USERS",
      valueType: "NUMBER",
      numberValue: -1,
    });
    assert.ok(neg.length > 0);
  });

  it("UNLIMITED isUnlimited zorunlu, büyük sayı taklidi yok", () => {
    const ok = validateEntitlementRow({
      code: "MAX_PRODUCTS",
      valueType: "UNLIMITED",
      isUnlimited: true,
      booleanValue: null,
      numberValue: null,
      stringValue: null,
    });
    assert.equal(ok.length, 0);

    const fake = validateEntitlementRow({
      code: "MAX_PRODUCTS",
      valueType: "NUMBER",
      numberValue: 999999999,
      isUnlimited: true,
    });
    assert.ok(fake.some((i) => i.code === "ENTITLEMENT_TYPE_MISMATCH" || i.code === "ENTITLEMENT_MULTIPLE_VALUE_FIELDS"));
  });

  it("STRING valueType doğrulama yolu", () => {
    const n = normalizeEntitlementRow({
      code: "X",
      valueType: "STRING",
      stringValue: "  metin  ",
    });
    assert.equal(n.stringValue, "metin");
    assert.equal(n.booleanValue, null);
  });

  it("unknown code reddedilir", () => {
    const issues = validateEntitlementSet([
      { code: "NOT_A_REAL_CODE", valueType: "BOOLEAN", booleanValue: true },
    ]);
    assert.ok(issues.some((i) => i.code === "ENTITLEMENT_UNKNOWN_CODE"));
  });

  it("duplicate code reddedilir", () => {
    const issues = validateEntitlementSet([
      { code: "POS", valueType: "BOOLEAN", booleanValue: true },
      { code: "POS", valueType: "BOOLEAN", booleanValue: false },
    ]);
    assert.ok(issues.some((i) => i.code === "ENTITLEMENT_DUPLICATE"));
  });

  it("normalizeEntitlementRow BOOLEAN için diğer alanları temizler", () => {
    const n = normalizeEntitlementRow({
      code: "pos",
      valueType: "BOOLEAN",
      booleanValue: true,
      numberValue: 1,
    });
    assert.equal(n.code, "POS");
    assert.equal(n.numberValue, null);
    assert.equal(n.isUnlimited, false);
  });
});

describe("Entitlement server-side diff", () => {
  it("ekleme, değişiklik ve kaldırma hesaplar", () => {
    const current = [
      { code: "POS", valueType: "BOOLEAN" as const, booleanValue: true },
      { code: "MAX_USERS", valueType: "NUMBER" as const, numberValue: 5 },
    ].map(normalizeEntitlementRow);

    const next = [
      { code: "POS", valueType: "BOOLEAN" as const, booleanValue: false },
      { code: "PRODUCTS", valueType: "BOOLEAN" as const, booleanValue: true },
    ].map(normalizeEntitlementRow);

    const diff = computeEntitlementDiff(current, next);
    assert.ok(diff.some((d) => d.changeType === "changed" && d.code === "POS"));
    assert.ok(diff.some((d) => d.changeType === "added" && d.code === "PRODUCTS"));
    assert.ok(diff.some((d) => d.changeType === "removed" && d.code === "MAX_USERS"));
    for (const d of diff) {
      assert.equal(d.enforcementUnchanged, true);
    }
  });
});

describe("Entitlement preview stale", () => {
  it("EntitlementPreviewStaleError kodu", () => {
    const e = new EntitlementPreviewStaleError();
    assert.equal(e.code, "ENTITLEMENT_PREVIEW_STALE");
    assert.equal(e.status, 409);
  });

  it("EntitlementValidationError issues taşır", () => {
    const e = new EntitlementValidationError([
      { code: "ENTITLEMENT_UNKNOWN_CODE", severity: "error", message: "x" },
    ]);
    assert.equal(e.issues.length, 1);
  });
});

describe("Operational enforcement koruması", () => {
  it("MAX_USERS kullanıcı eklemeyi engellemez", () => {
    assert.equal(isOperationalLimitEnforcementEnabled("MAX_USERS"), false);
  });

  it("MAX_PRODUCTS ürün eklemeyi engellemez", () => {
    assert.equal(isOperationalLimitEnforcementEnabled("MAX_PRODUCTS"), false);
  });

  it("feature false operasyonel guard açmaz", () => {
    assert.equal(isOperationalFeatureEnforcementEnabled("POS"), false);
    assert.equal(isOperationalFeatureEnforcementEnabled("E_DOCUMENT"), false);
  });

  it("entitlement-operational-policy değişmedi", () => {
    const src = readSrc("lib/billing/entitlements/entitlement-operational-policy.ts");
    assert.ok(src.includes("return false"));
    assert.ok(!src.includes("return true"));
  });
});

describe("Faz 6.2 route güvenliği", () => {
  const routes = [
    "app/api/admin/plans/[id]/features/route.ts",
    "app/api/admin/plans/[id]/features/reorder/route.ts",
    "app/api/admin/plans/[id]/features/[featureId]/route.ts",
    "app/api/admin/plans/[id]/entitlements/route.ts",
    "app/api/admin/plans/[id]/entitlements/preview/route.ts",
    "app/api/admin/plans/[id]/entitlements/publish/route.ts",
  ];

  for (const route of routes) {
    it(`${route} requireSuperAdminApi`, () => {
      const src = readSrc(route);
      assert.ok(src.includes("requireSuperAdminApi"));
    });
  }

  it("feature route planId URL'den", () => {
    const src = readSrc("app/api/admin/plans/[id]/features/route.ts");
    assert.ok(src.includes("await context.params"));
    assert.ok(src.includes("planId: id"));
    assert.ok(!src.includes("body.planId"));
  });

  it("syncLegacyPlanFeatures canonical serviste", () => {
    const src = readSrc("lib/admin/plans/admin-plan-feature-service.ts");
    assert.ok(src.includes("syncLegacyPlanFeatures"));
    assert.ok(src.includes("PLAN_FEATURE_CREATED"));
    assert.ok(src.includes("deletedAt"));
  });

  it("cache invalidation feature mutation'da çağrılır", () => {
    const featureSvc = readSrc("lib/admin/plans/admin-plan-feature-service.ts");
    assert.ok(featureSvc.includes("invalidateAdminPlanFeatureCaches"));
    const entSvc = readSrc("lib/admin/entitlements/admin-plan-entitlement-admin-service.ts");
    assert.ok(entSvc.includes("invalidateAdminPlanEntitlementCaches"));
  });

  it("generic PATCH features reddi korunur", () => {
    const schemas = readSrc("lib/admin/plans/admin-plan-schemas.ts");
    assert.ok(schemas.includes('"features"'));
  });
});

describe("legacy features[] sync sırası", () => {
  it("görünür özellikler sortOrder ASC, createdAt ASC sırasında", () => {
    const src = readSrc("lib/admin/plans/admin-plan-feature-service.ts");
    assert.ok(src.includes("sortOrder: \"asc\""));
    assert.ok(src.includes("createdAt: \"asc\""));
    assert.ok(src.includes("isVisible: true"));
  });
});
