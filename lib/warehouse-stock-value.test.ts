import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWarehouseMetrics } from "./warehouse-service";
import { calculateWarehouseStockValue } from "./inventory-value-utils";

describe("warehouse stock value consistency", () => {
  it("depo stok değeri buyPrice ile hesaplanır", () => {
    const warehouse = {
      stocks: [
        {
          quantity: 10,
          product: {
            buyPrice: 100,
            productType: "STOCK",
            minStock: 5,
            stock: 10,
          },
        },
        {
          quantity: 5,
          product: {
            buyPrice: 50,
            productType: "STOCK",
            minStock: 2,
            stock: 5,
          },
        },
      ],
    };

    const metrics = buildWarehouseMetrics(warehouse as never);
    assert.equal(metrics.totalValue, 1250);
  });

  it("sellPrice yerine buyPrice kullanılmazsa değer sıfır olur", () => {
    const brokenWarehouse = {
      stocks: [
        {
          quantity: 10,
          product: {
            sellPrice: 250,
            productType: "STOCK",
            minStock: 5,
            stock: 10,
          },
        },
      ],
    };

    const value = calculateWarehouseStockValue(brokenWarehouse.stocks as never);
    assert.equal(value, 0);
  });

  it("SERVICE ürün depo değerine dahil edilmez", () => {
    const value = calculateWarehouseStockValue([
      { quantity: 10, product: { productType: "SERVICE", buyPrice: 100 } },
      { quantity: 2, product: { productType: "STOCK", buyPrice: 50 } },
    ]);

    assert.equal(value, 100);
  });

  it("depo toplamları üst özet ile eşleşmeli", () => {
    const warehouses = [
      {
        stocks: [
          { quantity: 3, product: { buyPrice: 100, productType: "STOCK", minStock: 1, stock: 3 } },
        ],
      },
      {
        stocks: [
          { quantity: 2, product: { buyPrice: 50, productType: "STOCK", minStock: 1, stock: 2 } },
        ],
      },
    ];

    const total = warehouses.reduce(
      (sum, warehouse) => sum + buildWarehouseMetrics(warehouse as never).totalValue,
      0
    );

    assert.equal(total, 400);
  });
});
