/**
 * E-fatura/fatura — stok sıfır hizmet ürünü kaynak taraması + gerçek unit
 * testler (canAddProductToInvoice / getMaxQuantityForItem saf mantık, DB
 * gerektirmez).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";
import {
  canAddProductToInvoice,
  getMaxQuantityForItem,
  isServiceCatalogProduct,
  type CatalogProduct,
  type InvoiceLineItem,
} from "./invoice-form-utils";

const serviceProduct: CatalogProduct = {
  id: "svc-1",
  name: "Danışmanlık",
  stock: 0,
  sellPrice: 500,
  vatRate: 20,
  productType: "SERVICE",
};

const stockProduct: CatalogProduct = {
  id: "stk-1",
  name: "Kalem",
  stock: 0,
  sellPrice: 10,
  vatRate: 20,
  productType: "STOCK",
};

describe("canAddProductToInvoice — gerçek unit testler", () => {
  it("stok sıfır hizmet ürünü her zaman eklenebilir", () => {
    assert.equal(canAddProductToInvoice(serviceProduct, 0), true);
  });

  it("stok sıfır fiziksel ürün eklenemez (negatif stok izni yoksa)", () => {
    assert.equal(canAddProductToInvoice(stockProduct, 0), false);
  });

  it("isServiceCatalogProduct doğru ayrım yapar", () => {
    assert.equal(isServiceCatalogProduct(serviceProduct), true);
    assert.equal(isServiceCatalogProduct(stockProduct), false);
  });
});

describe("getMaxQuantityForItem — hizmet ürünü miktar sınırı yok", () => {
  it("hizmet ürünü için null döner (sınırsız miktar)", () => {
    const items: InvoiceLineItem[] = [
      { id: "1", productId: "svc-1", name: "Danışmanlık", quantity: 5, unitPrice: 500, vatRate: 20 },
    ];
    const result = getMaxQuantityForItem([serviceProduct], items, items[0]!);
    assert.equal(result, null);
  });
});

describe("fatura/e-fatura sayfaları — stok kontrolü hizmet ürününü istisna tutuyor", () => {
  const files = ["app/invoices/new/page.tsx", "app/invoices/e-invoice/page.tsx"];

  for (const file of files) {
    it(`${file}: validateItems/handleSave hizmet ürününü stok kontrolünden muaf tutuyor`, async () => {
      const content = await fs.readFile(file, "utf8");
      assert.ok(content.includes("isServiceCatalogProduct(product)"));
      assert.ok(content.includes("canAddProductToInvoice"));
    });

    it(`${file}: ürün seçici artık ham 'product.stock <= 0' ile hizmet ürününü engellemiyor`, async () => {
      const content = await fs.readFile(file, "utf8");
      const disabledIdx = content.indexOf("disabled={!canAdd}");
      assert.ok(disabledIdx !== -1, "picker butonu canAdd'e göre disable olmalı");
    });

    it(`${file}: hizmet ürünü için 'Stoksuz' etiketi kullanılıyor`, async () => {
      const content = await fs.readFile(file, "utf8");
      assert.ok(content.includes("getCatalogStockLabel(product)"));
    });
  }
});

describe("fatura oluşturma — sunucu tarafında stok hareketi üretilmiyor (tasarım gereği)", () => {
  it("app/api/invoices/create/route.ts stockMovement/stok düşme çağırmıyor", async () => {
    const content = await fs.readFile("app/api/invoices/create/route.ts", "utf8");
    assert.ok(!content.includes("stockMovement.create"));
    assert.ok(!content.includes("applySaleStockDecrement"));
  });

  it("app/api/invoices/create-e-invoice/route.ts da stok hareketi üretmiyor", async () => {
    const content = await fs.readFile("app/api/invoices/create-e-invoice/route.ts", "utf8");
    assert.ok(!content.includes("stockMovement.create"));
    assert.ok(!content.includes("applySaleStockDecrement"));
  });
});

describe("Sale (satış) akışı — canonical stok servisi hizmet ürününü zaten doğru istisna tutuyor (regresyon kilidi)", () => {
  it("validateSaleItemsStock hizmet ürününü atlar", async () => {
    const content = await fs.readFile("lib/sale-stock-utils.ts", "utf8");
    const fnStart = content.indexOf("export async function validateSaleItemsStock");
    const fnBody = content.slice(fnStart, content.indexOf("export async function applySaleStockDecrement"));
    assert.ok(fnBody.includes("isServiceProductType(product.productType)"));
    assert.ok(fnBody.includes("continue;"));
  });

  it("applySaleStockDecrement hizmet ürünü için stockMovement oluşturmaz", async () => {
    const content = await fs.readFile("lib/sale-stock-utils.ts", "utf8");
    const fnStart = content.indexOf("export async function applySaleStockDecrement");
    const fnBody = content.slice(fnStart);
    assert.ok(fnBody.includes("stockProductIds.has(item.productId)"));
    assert.ok(fnBody.includes("filter((product) => !isServiceProductType(product.productType))"));
  });

  it("negatif stok izni açıkken fiziksel ürün davranışı korunur (allowNegativeStock dalı)", async () => {
    const content = await fs.readFile("lib/sale-stock-utils.ts", "utf8");
    assert.ok(content.includes("if (allowNegativeStock) {"));
  });

  it("başka şirket ürünü stok sorgusuna dahil edilmiyor (companyId scope)", async () => {
    const content = await fs.readFile("lib/sale-stock-utils.ts", "utf8");
    const fnStart = content.indexOf("export async function validateSaleItemsStock");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("companyId,"));
  });
});
