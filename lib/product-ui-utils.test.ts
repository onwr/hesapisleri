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
      "Fiyat Bilgileri",
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

  it("ana sayfa renkli aksiyon kartları ve özet kartları kullanır", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.match(shell, /ProductsQuickActions/);
    assert.match(shell, /ProductsSummaryCards/);
    assert.match(shell, /ProductsSubNav/);
    assert.match(shell, /ProductsStockSyncButton/);
    assert.doesNotMatch(shell, /StatPill/);
    assert.doesNotMatch(shell, /ToolbarButton/);
  });

  it("quick action component siparişler stiline benzer gradient kartlar kullanır", () => {
    const actions = read("components/products/products-quick-actions.tsx");
    const utils = read("lib/products-page-ui-utils.ts");
    assert.match(actions, /rounded-2xl/);
    assert.match(actions, /ArrowRight/);
    assert.match(utils, /Yeni Ürün/);
    assert.match(utils, /Yeni Hizmet/);
    assert.match(utils, /Stok Hareketi/);
    assert.match(utils, /Depolar/);
    assert.match(utils, /SKU Eşlemeleri/);
    assert.match(utils, /Barkod İşlemleri/);
  });

  it("özet kartlarında stok değeri ve tür metrikleri görünür", () => {
    const summary = read("components/products/products-summary-cards.tsx");
    const utils = read("lib/products-page-ui-utils.ts");
    assert.match(summary, /ProductsSummaryCards/);
    assert.match(summary, /card\.title/);
    assert.match(utils, /Toplam Kalem/);
    assert.match(utils, /Stoklu Ürün/);
    assert.match(utils, /Hizmet/);
    assert.match(utils, /Düşük \/ Eksi Stok/);
    assert.match(utils, /Stok Değeri/);
    assert.match(utils, /Aktif Ürün/);
    assert.match(utils, /Alış fiyatına göre/);
  });

  it("ana sayfada duplicate toolbar butonları kaldırıldı", () => {
    const shell = read("components/products/products-shell.tsx");
    assert.doesNotMatch(shell, /Ürün Ekle/);
    assert.doesNotMatch(shell, /SKU Eşlemeleri/);
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

  it("ürün sayfası permission prop'larını shell'e geçirir", () => {
    const page = read("app/products/page.tsx");
    assert.match(page, /permissions/);
    assert.match(page, /canManageProducts/);
    assert.match(page, /canManageWarehouses/);
    assert.match(page, /canAccessModule\(effectiveRole, "stocks"/);
  });

  it("yeni hizmet formu type=service query ile açılır", () => {
    const page = read("app/products/new/page.tsx");
    assert.match(page, /type=service|params\.type/);
    assert.match(page, /initialProductType/);
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
    assert.match(form, /Fiyat Bilgileri/);
    assert.match(form, /POS Görünürlüğü/);
    assert.match(form, /PRODUCT_FORM_SECTION_CLASS/);
  });

  it("toplu işlem çubuğunda barkod yazdır vardır", () => {
    const table = read("components/products/products-selectable-table.tsx");
    assert.match(table, /Barkod Yazdır/);
    assert.match(table, /printProductBarcodesBulk/);
  });
});
