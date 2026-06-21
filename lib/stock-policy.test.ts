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
  it("allowsNegativeStock her zaman true döner", () => {
    assert.equal(allowsNegativeStock(), true);
  });

  it("negatif stok tespit eder", () => {
    assert.equal(isNegativeStock(-3), true);
    assert.equal(isNegativeStock(0), false);
  });

  it("yetersiz stok için uyarı üretir, engellemez", () => {
    const warning = getStockWarning(2, 5, "Kalem");
    assert.ok(warning?.includes(STOCK_WARNING_INSUFFICIENT));
    assert.ok(warning?.includes("Kalem"));
  });

  it("stok hareketi sonrası negatif uyarısı üretir", () => {
    assert.equal(
      getStockMovementWarning(3, -2),
      STOCK_WARNING_NEGATIVE_RESULT
    );
  });
});
