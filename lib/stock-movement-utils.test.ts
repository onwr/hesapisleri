import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateStockMovement } from "./stock-movement-utils";
import { STOCK_WARNING_NEGATIVE_RESULT } from "./stock-policy";

describe("calculateStockMovement", () => {
  it("IN stok artırır", () => {
    const result = calculateStockMovement("IN", 10, 5);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, 15);
    assert.equal(result.movementQuantity, 5);
    assert.equal(result.dbType, "IN");
  });

  it("OUT stok düşürür", () => {
    const result = calculateStockMovement("OUT", 10, 4);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, 6);
    assert.equal(result.movementQuantity, 4);
    assert.equal(result.dbType, "OUT");
  });

  it("OUT stoktan fazla olursa negatife düşer ve uyarı verir", () => {
    const result = calculateStockMovement("OUT", 10, 12);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, -2);
    assert.equal(result.warning, STOCK_WARNING_NEGATIVE_RESULT);
  });

  it("ADJUSTMENT negatif düzeltme uygular", () => {
    const result = calculateStockMovement("ADJUSTMENT", 10, -3);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, 7);
    assert.equal(result.movementQuantity, -3);
  });

  it("ADJUSTMENT stok eksiye düşerse işlem devam eder", () => {
    const result = calculateStockMovement("ADJUSTMENT", 5, -8);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, -3);
    assert.equal(result.warning, STOCK_WARNING_NEGATIVE_RESULT);
  });

  it("COUNT farkı doğru hesaplar (azalış)", () => {
    const result = calculateStockMovement("COUNT", 10, 7);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, 7);
    assert.equal(result.movementQuantity, -3);
    assert.equal(result.dbType, "COUNT");
  });

  it("COUNT farkı doğru hesaplar (artış)", () => {
    const result = calculateStockMovement("COUNT", 10, 15);
    assert.ok(!("error" in result));
    assert.equal(result.newStock, 15);
    assert.equal(result.movementQuantity, 5);
    assert.equal(result.dbType, "COUNT");
  });
});
