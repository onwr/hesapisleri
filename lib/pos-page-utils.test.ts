import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adjustCartQuantity,
  calculatePosChange,
  filterPosProducts,
  findPosProductByCode,
  getPosStockBadge,
  isPosProductOutOfStock,
  POS_QUICK_FILTER_LABELS,
  setCartItemQuantity,
} from "./pos-page-utils";

describe("pos page utils", () => {
  const products = [
    {
      id: "p1",
      name: "Kalem",
      stock: 0,
      sellPrice: 10,
      vatRate: 20,
      barcode: "8690001",
      sku: "SKU-1",
    },
    {
      id: "p2",
      name: "Defter",
      stock: 25,
      sellPrice: 50,
      vatRate: 20,
      barcode: "8690002",
      sku: "SKU-2",
    },
    {
      id: "p3",
      name: "Silgi",
      stock: -2,
      sellPrice: 8,
      vatRate: 20,
      sku: "SKU-3",
    },
  ];

  it("stok yok ürün bilgi amaçlı işaretlenir", () => {
    assert.equal(isPosProductOutOfStock(products[0], false), true);
    assert.equal(isPosProductOutOfStock(products[1], false), false);
  });

  it("negatif stok badge eksi stok gösterir", () => {
    const badge = getPosStockBadge(-2);
    assert.equal(badge.label, "Eksi stok");
  });

  it("sepet adet artır/azalt stok sınırına takılmaz", () => {
    const next = adjustCartQuantity(
      [{ productId: "p2", quantity: 2, stock: 3 }],
      "p2",
      1
    );
    assert.equal(next[0]?.quantity, 3);

    const beyond = adjustCartQuantity(
      [{ productId: "p2", quantity: 3, stock: 3 }],
      "p2",
      1
    );
    assert.equal(beyond[0]?.quantity, 4);
  });

  it("doğrudan miktar atama sıfırda satırı kaldırır", () => {
    const items = [
      { productId: "p1", quantity: 2, stock: 5 },
      { productId: "p2", quantity: 4, stock: 8 },
    ];

    const next = setCartItemQuantity(items, "p1", 0);
    assert.equal(next.length, 1);
    assert.equal(next[0]?.productId, "p2");

    const updated = setCartItemQuantity(items, "p2", 6);
    assert.equal(updated[1]?.quantity, 6);
  });

  it("barkod ile ürün bulur", () => {
    const found = findPosProductByCode(products, "8690002");
    assert.equal(found?.id, "p2");
  });

  it("stock filtresi stoklu ürünleri gösterir", () => {
    const withService = [
      ...products,
      {
        id: "s1",
        name: "Danışmanlık",
        stock: 0,
        productType: "SERVICE" as const,
        sellPrice: 500,
        vatRate: 20,
      },
    ];
    const filtered = filterPosProducts(withService, {
      quickFilter: "stock",
    });
    assert.equal(filtered.length, 3);
    assert.ok(filtered.every((item) => item.productType !== "SERVICE"));
  });

  it("service filtresi hizmet ürünlerini gösterir", () => {
    const withService = [
      ...products,
      {
        id: "s1",
        name: "Danışmanlık",
        stock: 0,
        productType: "SERVICE" as const,
        sellPrice: 500,
        vatRate: 20,
      },
    ];
    const filtered = filterPosProducts(withService, {
      quickFilter: "service",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.productType, "SERVICE");
  });

  it("para üstü hesaplama", () => {
    assert.equal(calculatePosChange(150, 120), 30);
    assert.equal(calculatePosChange(100, 120), 0);
  });

  it("quick filter etiketleri Türkçe", () => {
    assert.equal(POS_QUICK_FILTER_LABELS.all, "Tümü");
    assert.equal(POS_QUICK_FILTER_LABELS.stock, "Stoklu Ürünler");
    assert.equal(POS_QUICK_FILTER_LABELS.service, "Hizmetler");
    assert.equal(POS_QUICK_FILTER_LABELS.low_stock, "Düşük Stok");
  });
});
