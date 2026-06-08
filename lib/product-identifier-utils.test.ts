import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateProductBarcode,
  generateProductSku,
} from "./product-identifier-utils";

describe("product-identifier-utils", () => {
  it("generateProductSku STK formatı üretir", () => {
    const sku = generateProductSku(2026);
    assert.match(sku, /^STK-2026-\d{5}$/);
  });

  it("generateProductBarcode 13 haneli EAN üretir", () => {
    const barcode = generateProductBarcode();
    assert.equal(barcode.length, 13);
    assert.match(barcode, /^869\d{10}$/);
  });
});
