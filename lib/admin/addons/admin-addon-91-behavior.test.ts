/**
 * Faz 9.1 — Add-on UI tamamlama davranış testleri
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  adminAddonOverviewEditSchema,
  assertAddonTypeEditAllowed,
  assertNoForbiddenAddonPatchKeys,
  buildAddonOverviewPatchBody,
} from "@/lib/admin/addons/admin-addon-schemas";
import { priceRangesOverlap } from "@/lib/admin/addons/admin-addon-price-overlap";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("faz 9.1 pricing UI", () => {
  it("yeni fiyat formu doğru endpointleri kullanır", () => {
    const src = readSrc("components/admin/admin-addon-new-price-modal.tsx");
    assert.ok(src.includes("`/api/admin/add-ons/${addOnId}/prices`"));
    assert.ok(src.includes("`/api/admin/add-ons/${addOnId}/prices/${draftPrice.id}/publish`"));
    assert.ok(src.includes("confirm: true"));
  });

  it("fiyat overwrite edilmez — yeni version", () => {
    const src = readSrc("lib/admin/addons/addon-price-service.ts");
    assert.ok(src.includes("version: (latest?.version ?? 0) + 1"));
    assert.ok(src.includes("membershipAddOnPrice.create"));
    const publishBlock = src.slice(src.indexOf("export async function publishAddOnPrice"));
    assert.ok(publishBlock.includes('data: { status: "ACTIVE" }'));
    assert.ok(!publishBlock.includes("listPriceMinor"));
  });

  it("overlap reddedilir", () => {
    const a = { effectiveFrom: new Date("2026-01-01"), effectiveUntil: new Date("2026-12-01") };
    const b = { effectiveFrom: new Date("2026-06-01"), effectiveUntil: new Date("2027-06-01") };
    assert.equal(priceRangesOverlap(a, b), true);
    const modal = readSrc("components/admin/admin-addon-new-price-modal.tsx");
    assert.ok(modal.includes("res.status === 409"));
    assert.ok(modal.includes("Çakışma:"));
  });

  it("farklı currency birbirini expire etmez", () => {
    const src = readSrc("lib/admin/addons/addon-price-service.ts");
    assert.ok(src.includes("currency: price.currency"));
    assert.ok(src.includes("status: \"EXPIRED\""));
  });

  it("archived add-on fiyat oluşturma reddi", () => {
    const src = readSrc("lib/admin/addons/addon-price-service.ts");
    assert.ok(src.includes('addOn.status === "ARCHIVED"'));
    const modal = readSrc("components/admin/admin-addon-new-price-modal.tsx");
    assert.ok(modal.includes("isArchived"));
    assert.ok(modal.includes("Arşivlenmiş add-on için yeni fiyat oluşturulamaz"));
  });
});

describe("faz 9.1 overview edit UI", () => {
  it("strict overview schema geçerli", () => {
    const r = adminAddonOverviewEditSchema.safeParse({
      name: "Ek Kullanıcı",
      description: "Açıklama",
      sortOrder: 10,
      entitlementCode: "MAX_USERS",
      entitlementQuantity: 2,
      reason: "Güncelleme",
    });
    assert.equal(r.success, true);
  });

  it("metadata PATCH status reddi", () => {
    assert.throws(() => assertNoForbiddenAddonPatchKeys({ status: "ACTIVE" }));
  });

  it("type yalnız DRAFT iken patch bodyde", () => {
    const draftBody = buildAddonOverviewPatchBody(
      {
        name: "X",
        sortOrder: 1,
        type: "ONE_TIME",
        entitlementCode: "MAX_USERS",
        entitlementQuantity: 1,
        reason: "r",
      },
      { isDraft: true, currentType: "RECURRING" }
    );
    assert.equal(draftBody.type, "ONE_TIME");

    const activeBody = buildAddonOverviewPatchBody(
      {
        name: "X",
        sortOrder: 1,
        type: "ONE_TIME",
        entitlementCode: "MAX_USERS",
        entitlementQuantity: 1,
        reason: "r",
      },
      { isDraft: false, currentType: "RECURRING" }
    );
    assert.equal("type" in activeBody, false);
  });

  it("type DRAFT dışı reddedilir", () => {
    assert.throws(() => assertAddonTypeEditAllowed(false, { type: "ONE_TIME" }));
  });

  it("düzenle modalı PATCH kullanır", () => {
    const src = readSrc("components/admin/admin-addon-edit-modal.tsx");
    assert.ok(src.includes("`/api/admin/add-ons/${addOn.id}`"));
    assert.ok(src.includes('method: "PATCH"'));
    assert.ok(src.includes("isDraft ?"));
  });
});

describe("faz 9.1 güvenlik", () => {
  it("tenant admin reddi — requireSuperAdminApi", () => {
    const prices = readSrc("app/api/admin/add-ons/[id]/prices/route.ts");
    const patch = readSrc("app/api/admin/add-ons/[id]/route.ts");
    const publish = readSrc("app/api/admin/add-ons/[id]/prices/[priceId]/publish/route.ts");
    assert.ok(prices.includes("requireSuperAdminApi"));
    assert.ok(patch.includes("requireSuperAdminApi"));
    assert.ok(publish.includes("requireSuperAdminApi"));
  });

  it("yasak PATCH anahtarları", () => {
    assert.throws(() => assertNoForbiddenAddonPatchKeys({ isActive: true }));
    assert.throws(() => assertNoForbiddenAddonPatchKeys({ listPriceMinor: 100 }));
    assert.throws(() => assertNoForbiddenAddonPatchKeys({ resolvedEntitlement: "x" }));
  });
});
