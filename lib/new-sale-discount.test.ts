import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("new sale discount ui", () => {
  it("ödeme adımında indirim alanı görünür", () => {
    const page = read("app/sales/new/page.tsx");
    assert.match(page, /İndirim Türü/);
    assert.match(page, /İndirim Tutarı/);
    assert.match(page, /İndirim Yüzdesi/);
    assert.match(page, /İndirim Notu/);
    assert.match(page, /calculateSaleTotals/);
    assert.match(page, /discountType/);
    assert.match(page, /discountValue/);
  });

  it("sales create API indirim alanlarını kabul eder", () => {
    const route = read("app/api/sales/create/route.ts");
    assert.match(route, /discountType/);
    assert.match(route, /discountValue/);
    assert.match(route, /calculateSaleTotals/);
    assert.match(route, /discount,/);
  });

  it("POS indirim alanı korunur", () => {
    const panel = read("components/pos/pos-cart-panel.tsx");
    assert.match(panel, /İndirim \(₺\)/);
    const utils = read("lib/pos-checkout-utils.ts");
    assert.match(utils, /calculateSaleTotals/);
  });
});
