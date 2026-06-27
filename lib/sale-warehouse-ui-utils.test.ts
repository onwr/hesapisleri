import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { posCheckoutSchema } from "./pos-checkout-utils";
import {
  buildProductsListUrl,
  getSaleProductStock,
} from "./sale-warehouse-ui-utils";

describe("getSaleProductStock", () => {
  it("depo seçiliyken warehouseStock kullanır", () => {
    assert.equal(getSaleProductStock({ stock: 50, warehouseStock: 8 }, true), 8);
  });

  it("depo seçili değilken toplam stok kullanır", () => {
    assert.equal(
      getSaleProductStock({ stock: 50, warehouseStock: 8 }, false),
      50
    );
  });

  it("warehouseStock tanımsızsa toplam stoka düşer", () => {
    assert.equal(getSaleProductStock({ stock: 12 }, true), 12);
  });
});

describe("buildProductsListUrl", () => {
  it("warehouseId olmadan temel listeyi döner", () => {
    assert.equal(buildProductsListUrl(), "/api/products/list");
  });

  it("warehouseId ile sorgu parametresi ekler", () => {
    assert.equal(
      buildProductsListUrl("wh-1"),
      "/api/products/list?warehouseId=wh-1"
    );
  });
});

describe("posCheckoutSchema warehouseId", () => {
  it("warehouseId alanını kabul eder", () => {
    const parsed = posCheckoutSchema.safeParse({
      idempotencyKey: "a".repeat(16),
      warehouseId: "warehouse-1",
      paymentStatus: "UNPAID",
      items: [
        {
          productId: "p1",
          name: "Ürün",
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.warehouseId, "warehouse-1");
    }
  });
});
