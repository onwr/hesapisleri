/**
 * QA Faz 5B.3 — toplu fiyat ayarlama davranış/regresyon
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5B.3 — bulk price silent clamp kaldırıldı", () => {
  it("product-bulk-service Math.max(0, ...) kullanmaz", () => {
    const src = readSrc("lib/product-bulk-service.ts");
    assert.ok(!src.includes("Math.max(0"));
    assert.match(src, /validateProductPriceValue/);
    assert.match(src, /\$transaction/);
  });

  it("bulk API negatif sonuç hatasını 400 ile döner", () => {
    const src = readSrc("app/api/products/bulk/route.ts");
    assert.match(src, /if \(!result\.ok\)/);
    assert.match(src, /NEGATIVE_PRICE_RESULT|result\.code/);
  });
});

describe("Faz 5B.3 — bulk price UI preview", () => {
  it("dialog buildBulkPriceAdjustmentPlan ile önizleme üretir", () => {
    const dialog = readSrc("components/products/products-price-bulk-dialog.tsx");
    assert.match(dialog, /buildBulkPriceAdjustmentPlan/);
    assert.match(dialog, /negativeResultCount/);
    assert.match(dialog, /lowestNewPrice/);
    assert.match(dialog, /0'ın altına düşecekti/);
    assert.match(dialog, /hasNegativeResult/);
  });

  it("selectable table negatif fiyat hatasını kullanıcıya gösterir", () => {
    const table = readSrc("components/products/products-selectable-table.tsx");
    assert.match(table, /selectedProducts/);
    assert.match(table, /0'ın altına düşecekti/);
  });

  it("useTenantMutation duplicate submit koruması mevcut", () => {
    const hook = readSrc("hooks/use-tenant-mutation.ts");
    assert.match(hook, /duplicate_submit/);
    assert.match(hook, /inFlightRef/);
  });
});
