import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowsNegativeStock,
  getStockMovementWarning,
  getStockWarning,
  isNegativeStock,
  STOCK_WARNING_INSUFFICIENT,
  STOCK_WARNING_NEGATIVE_RESULT,
} from "./stock-policy";

describe("stock-policy", () => {
  it("allowsNegativeStock varsayılan false döner — negatif stok kapalı", () => {
    assert.equal(allowsNegativeStock(), false);
  });

  it("allowsNegativeStock(true) ile true döner", () => {
    assert.equal(allowsNegativeStock(true), true);
  });

  it("negatif stok tespit eder", () => {
    assert.equal(isNegativeStock(-3), true);
    assert.equal(isNegativeStock(0), false);
  });

  it("yetersiz stokta uyarı üretir", () => {
    const warning = getStockWarning(2, 5, "Kalem");
    assert.ok(warning?.includes(STOCK_WARNING_INSUFFICIENT));
    assert.ok(warning?.includes("Kalem"));
  });

  it("stok hareketi sonrası negatife düşerse uyarı üretir", () => {
    assert.equal(getStockMovementWarning(3, -2), STOCK_WARNING_NEGATIVE_RESULT);
  });
});

describe("stock-policy — STOCK_WARNING constants", () => {
  it("STOCK_WARNING_INSUFFICIENT tanımlı", () => {
    assert.ok(typeof STOCK_WARNING_INSUFFICIENT === "string");
    assert.ok(STOCK_WARNING_INSUFFICIENT.length > 0);
  });

  it("STOCK_WARNING_NEGATIVE_RESULT tanımlı", () => {
    assert.ok(typeof STOCK_WARNING_NEGATIVE_RESULT === "string");
    assert.ok(STOCK_WARNING_NEGATIVE_RESULT.length > 0);
  });
});
