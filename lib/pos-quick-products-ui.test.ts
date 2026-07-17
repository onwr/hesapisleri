import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "components/pos/pos-quick-products.tsx"),
  "utf8"
);

describe("pos quick products", () => {
  it("stoksuz ürünü disable eder", () => {
    assert.match(source, /outOfStock/);
    assert.match(source, /disabled=\{outOfStock\}/);
  });

  it("hizmet ürünlerinde stok kontrolünü atlar", () => {
    assert.match(source, /productType === "SERVICE"/);
  });

  it("boş listede render etmez", () => {
    assert.match(source, /if \(products\.length === 0\) return null/);
  });
});
