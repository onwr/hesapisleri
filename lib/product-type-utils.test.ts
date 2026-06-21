import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProductPayload } from "./product-form-utils";
import {
  emptyProductFormValues,
  type ProductFormValues,
} from "./product-form-utils";
import {
  isServiceProductType,
  isStockProductType,
  normalizeServiceProductFields,
  parseProductType,
  parseProductTypeFilter,
} from "./product-type-utils";

describe("product-type-utils", () => {
  it("parseProductType default STOCK", () => {
    assert.equal(parseProductType(null), "STOCK");
    assert.equal(parseProductType("SERVICE"), "SERVICE");
  });

  it("isServiceProductType doğru çalışır", () => {
    assert.equal(isServiceProductType("SERVICE"), true);
    assert.equal(isStockProductType("STOCK"), true);
  });

  it("normalizeServiceProductFields stok alanlarını sıfırlar", () => {
    const normalized = normalizeServiceProductFields({
      productType: "SERVICE",
      stock: 10,
      minStock: 5,
      barcode: "123",
      warehouseLocation: "A-1",
    });

    assert.equal(normalized.stock, 0);
    assert.equal(normalized.minStock, 0);
    assert.equal(normalized.barcode, null);
    assert.equal(normalized.warehouseLocation, null);
  });

  it("parseProductTypeFilter API filtresi", () => {
    assert.equal(parseProductTypeFilter("stock"), "STOCK");
    assert.equal(parseProductTypeFilter("service"), "SERVICE");
    assert.equal(parseProductTypeFilter(null), "all");
  });
});

describe("product form service payload", () => {
  it("SERVICE ürün payload stok ve barkod içermez", () => {
    const form: ProductFormValues = {
      ...emptyProductFormValues,
      productType: "SERVICE",
      name: "Montaj Hizmeti",
      sellPrice: "500",
      stock: "10",
      barcode: "8690001",
    };

    const payload = buildProductPayload(form, { barcodeMode: "include" });

    assert.equal(payload.productType, "SERVICE");
    assert.equal(payload.stock, 0);
    assert.equal(payload.barcode, null);
  });
});
