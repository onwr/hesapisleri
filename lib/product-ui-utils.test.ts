import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  getProductMarketplaceBadge,
  getProductPosVisibilityBadge,
  getProductStockBadge,
  isProductVisibleInPos,
  matchesProductStockFilter,
  PRODUCT_FORM_SECTIONS,
  PRODUCT_SORT_LABELS,
  PRODUCT_STOCK_FILTER_LABELS,
  sortProducts,
} from "./product-ui-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("product ui utils", () => {
  it("düşük stok badge amber döner", () => {
    const badge = getProductStockBadge({
      stock: 3,
      minStock: 10,
      isService: false,
    });
    assert.equal(badge.label, "Düşük stok");
    assert.match(badge.className, /amber/);
  });

  it("stok yok badge rose döner", () => {
    const badge = getProductStockBadge({
      stock: 0,
      minStock: 10,
      isService: false,
    });
    assert.equal(badge.label, "Stok yok");
    assert.match(badge.className, /rose/);
  });

  it("POS görünürlük badge aktif/pasif durumuna göre değişir", () => {
    assert.equal(isProductVisibleInPos("ACTIVE"), true);
    assert.equal(getProductPosVisibilityBadge("ACTIVE").label, "POS'ta gösteriliyor");
    assert.equal(getProductPosVisibilityBadge("PASSIVE").label, "POS'ta gizli");
  });

  it("marketplace mapping badge eşleme yoksa null döner", () => {
    assert.equal(getProductMarketplaceBadge([]), null);
    assert.equal(
      getProductMarketplaceBadge(["TRENDYOL"])?.label,
      "Trendyol eşli"
    );
  });

  it("stok filtresi ürünleri doğru süzer", () => {
    const product = { stock: 0, minStock: 5, isService: false };
    assert.equal(matchesProductStockFilter(product, "out_of_stock"), true);
    assert.equal(matchesProductStockFilter({ ...product, stock: 8 }, "in_stock"), true);
  });

  it("sıralama ada göre çalışır", () => {
    const sorted = sortProducts(
      [
        {
          name: "Zebra",
          stock: 1,
          sellPrice: 10,
          createdAt: new Date("2024-01-01"),
        },
        {
          name: "Armut",
          stock: 1,
          sellPrice: 10,
          createdAt: new Date("2024-01-02"),
        },
      ],
      "name"
    );
    assert.equal(sorted[0]?.name, "Armut");
  });

  it("filtre etiketleri Türkçe", () => {
    assert.equal(PRODUCT_STOCK_FILTER_LABELS.low_stock, "Düşük stok");
    assert.equal(PRODUCT_SORT_LABELS.recent, "Son eklenen");
  });

  it("form alan grupları tanımlı", () => {
    assert.deepEqual([...PRODUCT_FORM_SECTIONS], [
      "Temel Bilgiler",
      "Fiyatlandırma",
      "Stok & Barkod",
      "Durum",
    ]);
  });
});

describe("products compact management ui", () => {
  it("empty state metinleri tanımlı", () => {
    const empty = read("components/products/product-empty-state.tsx");
    assert.match(empty, /Henüz ürün eklenmedi/);
    assert.match(empty, /İlk ürününüzü ekleyerek stok ve satış takibine başlayın/);
    assert.match(empty, /Ürün Ekle/);
  });

  it("ürün listesi satırı placeholder ve badge içerir", () => {
    const row = read("components/products/product-list-row.tsx");
    assert.match(row, /ProductThumbnail/);
    assert.match(row, /getProductPosVisibilityBadge/);
    assert.match(row, /Barkod Yazdır/);
    assert.match(row, /PRODUCT_LIST_ROW_CLASS/);
  });

  it("filtre kartı arama alanı içerir ve Ürün Ekle tekrar etmez", () => {
    const filters = read("components/products/products-filters.tsx");
    assert.match(filters, /Ürün adı, barkod veya SKU ara/);
    assert.match(filters, /PRODUCT_FILTER_CARD_CLASS/);
    assert.match(filters, /Gelişmiş filtreler/);
    assert.doesNotMatch(filters, /Ürün Ekle/);
  });

  it("ana sayfa kompakt başlık, özet bar ve stok senkron butonu kullanır", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.match(shell, /Ürünler/);
    assert.match(shell, /Ürün, stok, fiyat ve barkod yönetimi/);
    assert.match(shell, /PRODUCT_STATS_BAR_CLASS/);
    assert.match(shell, /StatPill/);
    assert.match(shell, /ProductsStockSyncButton/);
    assert.match(shell, /SKU Eşlemeleri/);
    assert.doesNotMatch(shell, /StatCard/);
    assert.doesNotMatch(shell, /ActionCard/);
  });

  it("ana sayfada duplicate Ürün Ekle ve SKU Eşlemeleri aksiyonu yok", () => {
    const shell = read("components/products/products-shell.tsx");
    const addCount = (shell.match(/Ürün Ekle/g) ?? []).length;
    const skuCount = (shell.match(/SKU Eşlemeleri/g) ?? []).length;
    assert.equal(addCount, 1);
    assert.equal(skuCount, 1);
  });

  it("action card bölümü kaldırıldı", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.doesNotMatch(shell, /ActionCard/);
    assert.doesNotMatch(shell, /Kategori Yönetimi/);
  });

  it("kompakt stat summary render edilir", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.match(shell, /Düşük Stok/);
    assert.match(shell, /Stok Yok/);
    assert.match(shell, /Stok Değeri/);
  });

  it("desktop tablo ve mobil kart satırı birlikte kullanılır", () => {
    const table = read("components/products/products-selectable-table.tsx");
    assert.match(table, /ProductTableDesktopRow/);
    assert.match(table, /ProductListRow/);
    assert.match(table, /<table/);
    assert.match(table, /md:hidden/);
    assert.match(table, /hidden md:block/);
  });

  it("stok senkron butonu OWNER/ADMIN için canSync ile görünür", () => {
    const button = read("components/products/products-stock-sync-button.tsx");
    assert.match(button, /if \(!canSync\) return null/);
    assert.match(button, /Stokları Senkronla/);
    const page = read("app/products/page.tsx");
    assert.match(page, /canSyncStock/);
    assert.match(page, /effectiveRole === "ADMIN"/);
  });

  it("ürün detay kompakt stok özeti ve stok merkezi linki tanımlı", () => {
    const detail = read("components/products/product-detail-view.tsx");
    assert.match(detail, /Mevcut Stok/);
    assert.match(detail, /Kritik Stok/);
    assert.match(detail, /Stok Merkezi/);
    assert.match(detail, /Bu Ay Satış/);
    assert.match(detail, /Pazaryeri Eşlemeleri/);
    assert.doesNotMatch(detail, /Depo Bazlı Stok/);
    assert.doesNotMatch(detail, /StatCard/);
  });

  it("ürün formu alan grupları içerir", () => {
    const form = read("components/products/product-form-fields.tsx");
    assert.match(form, /Temel Bilgiler/);
    assert.match(form, /Stok & Barkod/);
    assert.match(form, /Fiyatlandırma/);
    assert.match(form, /POS Görünürlüğü/);
    assert.match(form, /PRODUCT_FORM_SECTION_CLASS/);
  });

  it("toplu işlem çubuğunda barkod yazdır vardır", () => {
    const table = read("components/products/products-selectable-table.tsx");
    assert.match(table, /Barkod Yazdır/);
    assert.match(table, /printProductBarcodesBulk/);
  });
});
