import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterMovementsByTab,
  getMovementText,
  isLowStock,
  mapProductToStockRow,
  resolveProductMinStock,
} from "./stocks-page-utils";

describe("stocks-page-utils", () => {
  it('getMovementText("COUNT") → Stok Sayımı', () => {
    assert.equal(getMovementText("COUNT"), "Stok Sayımı");
    assert.equal(getMovementText("ADJUSTMENT"), "Stok Düzeltme");
  });

  it("COUNT hareketi count sekmesinde görünür", () => {
    const rows = [
      {
        id: "1",
        productId: "p1",
        productName: "Ürün A",
        categoryName: "Genel",
        type: "COUNT",
        quantity: -2,
        note: null,
        warehouseName: "Ana Depo",
        createdAt: new Date(),
        detailHref: "/products/p1",
      },
      {
        id: "2",
        productId: "p2",
        productName: "Ürün B",
        categoryName: "Genel",
        type: "ADJUSTMENT",
        quantity: 3,
        note: null,
        warehouseName: null,
        createdAt: new Date(),
        detailHref: "/products/p2",
      },
    ];

    const countRows = filterMovementsByTab(rows, "count");
    assert.equal(countRows.length, 1);
    assert.equal(countRows[0]?.type, "COUNT");
  });

  it("ADJUSTMENT count sekmesinde görünmez", () => {
    const rows = [
      {
        id: "2",
        productId: "p2",
        productName: "Ürün B",
        categoryName: "Genel",
        type: "ADJUSTMENT",
        quantity: 3,
        note: null,
        warehouseName: null,
        createdAt: new Date(),
        detailHref: "/products/p2",
      },
    ];

    assert.equal(filterMovementsByTab(rows, "count").length, 0);
  });

  it("transfer sekmesi movement filtresinden ayrıdır", () => {
    const rows = [
      {
        id: "3",
        productId: "p3",
        productName: "Ürün C",
        categoryName: "Genel",
        type: "TRANSFER_IN",
        quantity: 5,
        note: "depo transfer",
        warehouseName: "Ana Depo",
        createdAt: new Date(),
        detailHref: "/products/p3",
      },
    ];

    assert.equal(filterMovementsByTab(rows, "movements").length, 1);
    assert.equal(filterMovementsByTab(rows, "count").length, 0);
  });

  it("düşük stok product.minStock ile hesaplanır", () => {
    assert.equal(isLowStock(6, 5), false);
    assert.equal(isLowStock(5, 5), true);
    assert.equal(isLowStock(4, 5), true);
    assert.equal(isLowStock(0, 5), true);
    assert.equal(isLowStock(-2, 5), true);
  });

  it("mapProductToStockRow minStock kullanır", () => {
    const row = mapProductToStockRow(
      {
        id: "p1",
        name: "Test",
        description: null,
        sku: "SKU-1",
        stock: 5,
        minStock: 5,
        sellPrice: 100,
        imageUrl: null,
        category: { name: "Genel" },
      },
      0
    );

    assert.equal(row.criticalLevel, 5);
    assert.equal(row.statusLabel, "Düşük Stok");
    assert.equal(row.stockMovementHref, "/products/p1/stock");
  });

  it("minStock yoksa fallback 10 kullanılır", () => {
    assert.equal(resolveProductMinStock(null), 10);
    assert.equal(resolveProductMinStock(undefined), 10);
  });
});
