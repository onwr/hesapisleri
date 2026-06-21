import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("product barcode ui", () => {
  it("create form otomatik barkod prefill yapmaz", () => {
    const form = read("components/products/new-product-form.tsx");
    assert.doesNotMatch(form, /prefillIdentifiers/);
    assert.doesNotMatch(form, /generate-identifiers\`\)/);
  });

  it("product form barkod toggle içerir", () => {
    const fields = read("components/products/product-form-fields.tsx");
    assert.match(fields, /Barkod bilgisi ekle/);
    assert.match(fields, /Otomatik Oluştur/);
    assert.match(fields, /Barkodu Kaldır/);
    assert.doesNotMatch(fields, /SKU ve Barkod Otomatik Oluştur/);
  });

  it("generate-barcode endpoint tanımlı", () => {
    const route = read("app/api/products/generate-barcode/route.ts");
    assert.match(route, /generateUniqueProductBarcode/);
    assert.match(route, /POST/);
  });

  it("barcode print utils korunur", () => {
    const utils = read("lib/barcode-print-utils.ts");
    assert.match(utils, /missing_barcode/);
    assert.match(utils, /Bu ürünün barkodu bulunmuyor/);
  });
});

describe("product service barcode message", () => {
  it("duplicate barkod mesajı kullanıcı dostu", () => {
    const service = read("lib/product-service.ts");
    assert.match(service, /Bu barkod başka bir üründe kullanılıyor/);
  });
});
