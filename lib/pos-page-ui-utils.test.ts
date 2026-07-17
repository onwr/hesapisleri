import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildPosFilterChips,
  buildPosQuickActionCards,
  buildPosSummaryMetrics,
} from "./pos-page-ui-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("pos page ui utils", () => {
  it("quick action kartları tanımlı", () => {
    const cards = buildPosQuickActionCards();
    assert.equal(cards.length, 5);
    assert.ok(cards.some((card) => card.key === "barcode"));
    assert.ok(cards.some((card) => card.key === "stock"));
    assert.ok(cards.some((card) => card.key === "service"));
    assert.ok(cards.some((card) => card.key === "discount"));
    assert.ok(cards.some((card) => card.key === "payment"));
  });

  it("filtre chipleri tanımlı", () => {
    const chips = buildPosFilterChips();
    assert.equal(chips.length, 4);
    assert.ok(chips.some((chip) => chip.key === "low_stock"));
  });

  it("özet metrikleri üretir", () => {
    const metrics = buildPosSummaryMetrics({
      todaySalesCount: 3,
      todaySalesTotal: 1500,
      cartTotal: 250,
      cartLineCount: 2,
      cartItemCount: 4,
    });
    assert.equal(metrics.length, 3);
    assert.equal(metrics[0]?.value, "3");
    assert.equal(metrics[2]?.subtitle, "4 adet");
  });

  it("nakit ve kart metriklerini dahil eder", () => {
    const metrics = buildPosSummaryMetrics({
      todaySalesCount: 3,
      todaySalesTotal: 1500,
      todayCashTotal: 900,
      todayCardTotal: 600,
      cartTotal: 250,
      cartLineCount: 2,
      cartItemCount: 4,
    });
    assert.equal(metrics.length, 4);
    assert.equal(metrics[1]?.key, "today-tender");
    assert.ok(metrics[1]?.subtitle?.includes("Kart"));
  });
});

describe("pos colorful ui", () => {
  it("POS sayfasında renkli quick action kartları görünür", () => {
    const page = read("app/pos/page.tsx");
    assert.match(page, /PosQuickActions/);
    assert.match(page, /PosSummaryMetrics/);
    assert.match(page, /PosQuickProducts/);
    assert.match(page, /PosCustomerPicker/);
    assert.match(page, /searchRef/);
    assert.match(page, /todayCashTotal/);
    assert.match(page, /Satışı Görüntüle/);
    assert.match(page, /Fatura Oluştur/);
    assert.match(page, /Barkodlu satış işlemlerinizi hızlıca/i);
  });

  it("sepet paneli indirim ve gradient checkout içerir", () => {
    const panel = read("components/pos/pos-cart-panel.tsx");
    assert.match(panel, /İndirim \(₺\)/);
    assert.match(panel, /Satışı Tamamla/);
    assert.match(panel, /POS_GRADIENT_CHECKOUT_CLASS/);
    assert.match(panel, /Genel Toplam/);
  });

  it("ürün grid hizmet ve eksi stok badge içerir", () => {
    const grid = read("components/pos/pos-product-grid.tsx");
    assert.match(grid, /getPosStockBadge/);
    assert.match(grid, /Hizmet/);
    assert.match(grid, /Ekle/);
    assert.doesNotMatch(grid, /disabled/);
  });

  it("kategori filtreleri renkli chip kullanır", () => {
    const filter = read("components/pos/pos-category-filter.tsx");
    assert.match(filter, /buildPosFilterChips/);
    assert.match(filter, /rounded-full/);
  });

  it("calculateSaleTotals merkezi helper korunur", () => {
    const utils = read("lib/pos-checkout-utils.ts");
    assert.match(utils, /calculateSaleTotals/);
  });
});
