/**
 * Faz 9 — Add-on Yönetimi davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminAddonActivateSchema,
  adminAddonCreateSchema,
  adminAddonUpdateSchema,
  assertNoForbiddenAddonCreateKeys,
  assertNoForbiddenAddonPatchKeys,
} from "@/lib/admin/addons/admin-addon-schemas";
import {
  detectAddOnIssues,
  validateEntitlementCode,
} from "@/lib/admin/addons/admin-addon-issue-service";
import {
  buildStructuredAddOnActivityWhere,
  matchesStructuredAddOnScope,
} from "@/lib/admin/addons/admin-addon-activity-scope";
import { buildAddOnAuditMetadata } from "@/lib/admin/addons/admin-addon-audit-service";
import { priceRangesOverlap } from "@/lib/admin/addons/admin-addon-price-overlap";
import { findEffectiveAddOnPricesAt } from "@/lib/admin/addons/admin-addon-price-resolution-utils";
import { parseAddOnListFilters, DEFAULT_ADDON_PAGE_SIZE } from "@/lib/admin/addons/addon-types";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("addon create schema", () => {
  it("draft create geçerli", () => {
    const r = adminAddonCreateSchema.safeParse({
      name: "Ek Kullanıcı",
      code: "EXTRA_USER",
      type: "RECURRING",
      entitlementCode: "MAX_USERS",
      entitlementQuantity: 5,
      currency: "TRY",
    });
    assert.equal(r.success, true);
  });

  it("client status reddedilir", () => {
    assert.throws(() => assertNoForbiddenAddonCreateKeys({ name: "X", status: "ACTIVE" }));
  });

  it("generic status PATCH reddedilir", () => {
    assert.throws(() => assertNoForbiddenAddonPatchKeys({ status: "ACTIVE" }));
  });
});

describe("addon entitlement validation", () => {
  it("unknown entitlement issue", () => {
    const issues = validateEntitlementCode("NOT_A_REAL_CODE_XYZ");
    assert.ok(issues.some((i) => i.code === "UNKNOWN_ENTITLEMENT"));
  });
});

describe("addon price overlap", () => {
  it("çakışan aralıklar", () => {
    const a = { effectiveFrom: new Date("2026-01-01"), effectiveUntil: new Date("2026-12-01") };
    const b = { effectiveFrom: new Date("2026-06-01"), effectiveUntil: new Date("2027-06-01") };
    assert.equal(priceRangesOverlap(a, b), true);
  });

  it("scheduled resolution — gelecek fiyat şimdilik efektif değil", () => {
    const future = new Date(Date.now() + 86_400_000 * 30);
    const prices = [
      {
        billingInterval: "MONTHLY" as const,
        currency: "TRY",
        status: "ACTIVE",
        effectiveFrom: future,
        effectiveUntil: null,
      },
    ];
    const effective = findEffectiveAddOnPricesAt(prices, "MONTHLY", "TRY", new Date());
    assert.equal(effective.length, 0);
  });
});

describe("addon issues", () => {
  it("ACTIVE_WITHOUT_PRICE", async () => {
    const issues = await detectAddOnIssues({
      id: "a1",
      status: "ACTIVE",
      type: "RECURRING",
      currency: "TRY",
      entitlementCode: "MAX_USERS",
      entitlementQuantity: 1,
      prices: [],
    });
    assert.ok(issues.some((i) => i.code === "ACTIVE_WITHOUT_PRICE"));
  });

  it("INVALID_QUANTITY", async () => {
    const issues = await detectAddOnIssues({
      id: "a1",
      status: "DRAFT",
      type: "USAGE_PACK",
      currency: "TRY",
      entitlementCode: "MAX_USERS",
      entitlementQuantity: 0,
      prices: [],
    });
    assert.ok(issues.some((i) => i.code === "INVALID_QUANTITY"));
  });
});

describe("addon activity structured scope", () => {
  it("entityType MembershipAddOn", () => {
    assert.equal(
      matchesStructuredAddOnScope(
        {
          id: "1",
          action: "ADDON_CREATED",
          module: "admin-addons",
          message: "x",
          entityType: "MembershipAddOn",
          entityId: "ao-1",
          metadata: null,
        },
        "ao-1"
      ),
      true
    );
  });

  it("structured where üretir", () => {
    assert.ok(buildStructuredAddOnActivityWhere("ao-x").OR);
  });
});

describe("addon audit metadata", () => {
  it("addOnId metadata", () => {
    const meta = buildAddOnAuditMetadata("ao-9", { reason: "test" });
    assert.equal(meta.addOnId, "ao-9");
  });
});

describe("addon routes and security", () => {
  it("canonical /admin/add-ons sayfası", () => {
    assert.ok(readSrc("app/admin/add-ons/page.tsx").includes("listAddOns"));
  });

  it("legacy redirect", () => {
    assert.ok(readSrc("app/admin/membership-addons/page.tsx").includes("/admin/add-ons"));
  });

  it("mutation DRAFT oluşturur", () => {
    const src = readSrc("lib/admin/addons/addon-mutation-service.ts");
    assert.ok(src.includes('status: "DRAFT"'));
  });

  it("fiyat overwrite yok — yeni version", () => {
    const src = readSrc("lib/admin/addons/addon-price-service.ts");
    assert.ok(src.includes("version: (latest?.version ?? 0) + 1"));
    assert.ok(!src.includes("updateMany({") || src.includes("status: \"EXPIRED\""));
  });

  it("cache invalidation", () => {
    const src = readSrc("lib/admin/addons/admin-addon-cache.ts");
    assert.ok(src.includes("entitlement-resolver"));
    assert.ok(src.includes("checkout-plan"));
  });

  it("activate confirm zorunlu", () => {
    assert.equal(adminAddonActivateSchema.safeParse({ reason: "x" }).success, false);
    assert.equal(
      adminAddonActivateSchema.safeParse({ reason: "x", confirm: true }).success,
      true
    );
  });

  it("pageSize 25/50/100", () => {
    assert.equal(parseAddOnListFilters({ pageSize: "50" }).pageSize, 50);
    assert.equal(parseAddOnListFilters({ pageSize: "99" }).pageSize, DEFAULT_ADDON_PAGE_SIZE);
  });
});

describe("addon update schema", () => {
  it("boş PATCH reddedilir", () => {
    assert.equal(adminAddonUpdateSchema.safeParse({}).success, false);
  });
});
