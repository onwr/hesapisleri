import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeCategoryStats,
  summarizeProductCategoriesPage,
} from "./product-category-service";

describe("product category stats", () => {
  const categories = [
    {
      id: "cat-1",
      name: "Genel",
      color: "slate",
      note: null,
      status: "ACTIVE",
      sortOrder: 0,
    },
    {
      id: "cat-2",
      name: "Elektronik",
      color: "blue",
      note: null,
      status: "ACTIVE",
      sortOrder: 1,
    },
  ];

  const products = [
    {
      categoryId: "cat-1",
      name: "Kalem",
      description: null,
      stock: 5,
      minStock: 10,
      sellPrice: 20,
      status: "ACTIVE",
    },
    {
      categoryId: "cat-2",
      name: "Telefon",
      description: null,
      stock: 3,
      minStock: 2,
      sellPrice: 1000,
      status: "ACTIVE",
    },
    {
      categoryId: null,
      name: "Kategorisiz",
      description: null,
      stock: 1,
      minStock: 5,
      sellPrice: 50,
      status: "ACTIVE",
    },
  ];

  it("kategori istatistiklerini doğru hesaplar", () => {
    const stats = computeCategoryStats(products, "cat-2", "Elektronik");

    assert.equal(stats.productCount, 1);
    assert.equal(stats.totalStock, 3);
    assert.equal(stats.stockValue, 3000);
    assert.equal(stats.lowStockCount, 0);
  });

  it("düşük stok sayısını hesaplar", () => {
    const stats = computeCategoryStats(products, "cat-1", "Genel");

    assert.equal(stats.productCount, 1);
    assert.equal(stats.lowStockCount, 1);
  });

  it("sayfa özetini doğru hesaplar", () => {
    const summary = summarizeProductCategoriesPage(categories, products);

    assert.equal(summary.totalCategories, 2);
    assert.equal(summary.activeCategories, 2);
    assert.equal(summary.totalProducts, 3);
    assert.equal(summary.uncategorizedProducts, 1);
    assert.equal(summary.lowStockProducts, 2);
  });
});

describe("normalizeProductCategoryName", () => {
  it("boş kategori adını Genel yapar", async () => {
    const { normalizeProductCategoryName } = await import(
      "./product-category-utils"
    );

    assert.equal(normalizeProductCategoryName(""), "Genel");
    assert.equal(normalizeProductCategoryName("  Elektronik  "), "Elektronik");
  });
});
