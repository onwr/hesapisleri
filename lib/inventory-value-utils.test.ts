import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateInventoryValue,
  calculateProductStockValue,
  calculateWarehouseStockValue,
  getProductPurchasePrice,
} from "./inventory-value-utils";

describe("inventory value utils", () => {
  it("stok değerini alış fiyatı ile hesaplar", () => {
    const value = calculateProductStockValue({
      productType: "STOCK",
      stock: 10,
      buyPrice: 100,
      sellPrice: 250,
    });

    assert.equal(value, 1000);
  });

  it("SERVICE ürün stok değeri 0 olur", () => {
    const value = calculateProductStockValue({
      productType: "SERVICE",
      stock: 10,
      buyPrice: 100,
      sellPrice: 250,
    });

    assert.equal(value, 0);
  });

  it("purchasePrice null/boşsa stok değeri 0 olur", () => {
    assert.equal(
      calculateProductStockValue({
        productType: "STOCK",
        stock: 10,
        buyPrice: null,
      }),
      0
    );

    assert.equal(
      calculateProductStockValue({
        productType: "STOCK",
        stock: 10,
      }),
      0
    );
  });

  it("negatif stokta negatif stok değeri döner", () => {
    const value = calculateProductStockValue({
      productType: "STOCK",
      stock: -2,
      buyPrice: 100,
    });

    assert.equal(value, -200);
  });

  it("getProductPurchasePrice buyPrice kullanır", () => {
    assert.equal(getProductPurchasePrice({ buyPrice: 42.5 }), 42.5);
    assert.equal(getProductPurchasePrice({ purchasePrice: 15 }), 15);
  });

  it("calculateWarehouseStockValue depo miktarı x alış fiyatı toplar", () => {
    const total = calculateWarehouseStockValue([
      { quantity: 5, product: { productType: "STOCK", buyPrice: 100 } },
      { quantity: 2, product: { productType: "STOCK", buyPrice: 50 } },
    ]);

    assert.equal(total, 600);
  });

  it("calculateWarehouseStockValue SERVICE ürünü hariç tutar", () => {
    const total = calculateWarehouseStockValue([
      { quantity: 4, product: { productType: "SERVICE", buyPrice: 100 } },
      { quantity: 2, product: { productType: "STOCK", buyPrice: 50 } },
    ]);

    assert.equal(total, 100);
  });

  it("calculateInventoryValue tüm stoklu ürünleri toplar", () => {
    const total = calculateInventoryValue([
      { productType: "STOCK", stock: 3, buyPrice: 100, sellPrice: 200 },
      { productType: "SERVICE", stock: 5, buyPrice: 50, sellPrice: 100 },
      { productType: "STOCK", stock: 2, buyPrice: 25, sellPrice: 80 },
    ]);

    assert.equal(total, 350);
  });
});
