import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStockReturnEntries } from "./sale-cancel-stock-utils";

describe("buildStockReturnEntries", () => {
  it("saleItem warehouseId varsa aynı depoya iade gruplar", () => {
    const entries = buildStockReturnEntries(
      [
        {
          productId: "p1",
          warehouseId: "wh-a",
          quantity: 2,
        },
        {
          productId: "p1",
          warehouseId: "wh-a",
          quantity: 1,
        },
      ],
      [],
      "wh-default"
    );

    assert.deepEqual(entries, [
      { productId: "p1", warehouseId: "wh-a", quantity: 3 },
    ]);
  });

  it("saleItem warehouseId yoksa SALE hareketindeki depoyu kullanır", () => {
    const entries = buildStockReturnEntries(
      [{ productId: "p1", warehouseId: null, quantity: 2 }],
      [
        {
          productId: "p1",
          warehouseId: "wh-b",
          quantity: -2,
        },
      ],
      "wh-default"
    );

    assert.deepEqual(entries, [
      { productId: "p1", warehouseId: "wh-b", quantity: 2 },
    ]);
  });

  it("hiç depo bilgisi yoksa varsayılan depoya iade eder", () => {
    const entries = buildStockReturnEntries(
      [{ productId: "p2", warehouseId: null, quantity: 4 }],
      [],
      "wh-default"
    );

    assert.deepEqual(entries, [
      { productId: "p2", warehouseId: "wh-default", quantity: 4 },
    ]);
  });
});
