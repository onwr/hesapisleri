import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProductQuickActionCards,
  buildProductSummaryCards,
  filterProductQuickActionCards,
} from "./products-page-ui-utils";

describe("products page ui utils", () => {
  it("quick action kartları tanımlı", () => {
    const cards = buildProductQuickActionCards();

    assert.equal(cards.length, 6);
    assert.equal(cards[0]?.href, "/products/new");
    assert.equal(cards[1]?.href, "/products/new?type=service");
    assert.equal(cards[2]?.href, "/products/stocks");
    assert.equal(cards[3]?.href, "/products/stocks/warehouses");
    assert.equal(cards[4]?.href, "/products/channel-mapping");
    assert.equal(cards[5]?.href, "#products-list");
  });

  it("create yetkisi olmayan kullanıcı yeni ürün/hizmet kartlarını görmez", () => {
    const filtered = filterProductQuickActionCards(buildProductQuickActionCards(), {
      canCreateProduct: false,
      canManageStocks: true,
      canManageWarehouses: true,
      canManageProducts: true,
    });

    assert.equal(
      filtered.some((card) => card.key === "new-product"),
      false
    );
    assert.equal(
      filtered.some((card) => card.key === "new-service"),
      false
    );
    assert.equal(
      filtered.some((card) => card.key === "stock-movement"),
      true
    );
  });

  it("depo yetkisi olmayan kullanıcı depolar kartını görmez", () => {
    const filtered = filterProductQuickActionCards(buildProductQuickActionCards(), {
      canCreateProduct: true,
      canManageStocks: true,
      canManageWarehouses: false,
      canManageProducts: true,
    });

    assert.equal(
      filtered.some((card) => card.key === "warehouses"),
      false
    );
  });

  it("stok yetkisi olmayan kullanıcı stok hareketi kartını görmez", () => {
    const filtered = filterProductQuickActionCards(buildProductQuickActionCards(), {
      canCreateProduct: true,
      canManageStocks: false,
      canManageWarehouses: true,
      canManageProducts: true,
    });

    assert.equal(
      filtered.some((card) => card.key === "stock-movement"),
      false
    );
  });

  it("özet kartları stok değerini alış fiyatına göre gösterir", () => {
    const cards = buildProductSummaryCards({
      totalProducts: 10,
      stockProducts: 7,
      serviceProducts: 3,
      activeProducts: 8,
      lowStockProducts: 2,
      outOfStockProducts: 1,
      lowOrNegativeStock: 3,
      totalStockValue: 1000,
    });

    const inventoryCard = cards.find((card) => card.key === "inventory-value");
    assert.equal(inventoryCard?.subtitle, "Alış fiyatına göre");
    assert.match(inventoryCard?.value ?? "", /1\.000/);

    const serviceCard = cards.find((card) => card.key === "service-products");
    assert.equal(serviceCard?.value, "3");
  });
});
