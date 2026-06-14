import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  adjustCartQuantity,
  calculatePosChange,
  filterPosProducts,
  findPosProductByCode,
  isPosProductOutOfStock,
  POS_QUICK_FILTER_LABELS,
} from "./pos-page-utils";
import {
  canAccessModule,
  getAccessibleModules,
  getPostAuthRedirectPath,
} from "./permission-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

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
      stock: 5,
      sellPrice: 8,
      vatRate: 20,
      sku: "SKU-3",
    },
  ];

  it("stok yok ürün disabled olarak işaretlenir", () => {
    assert.equal(isPosProductOutOfStock(products[0], false), true);
    assert.equal(isPosProductOutOfStock(products[1], false), false);
  });

  it("boş sepet empty state metinleri tanımlı", () => {
    const cart = read("components/pos/pos-cart-panel.tsx");
    assert.match(cart, /Sepet boş/);
    assert.match(cart, /Satışa başlamak için ürün ekleyin/);
  });

  it("sepet adet artır/azalt yardımcısı stok sınırına uyar", () => {
    const next = adjustCartQuantity(
      [{ productId: "p2", quantity: 2, stock: 3 }],
      "p2",
      1
    );
    assert.equal(next[0]?.quantity, 3);

    const blocked = adjustCartQuantity(
      [{ productId: "p2", quantity: 3, stock: 3 }],
      "p2",
      1
    );
    assert.equal(blocked[0]?.quantity, 3);
  });

  it("barkod ile ürün bulur", () => {
    const found = findPosProductByCode(products, "8690002");
    assert.equal(found?.id, "p2");
  });

  it("in_stock filtresi stoksuz ürünleri gizler", () => {
    const filtered = filterPosProducts(products, {
      quickFilter: "in_stock",
    });
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((item) => item.stock > 0));
  });

  it("para üstü hesaplama", () => {
    assert.equal(calculatePosChange(150, 120), 30);
    assert.equal(calculatePosChange(100, 120), 0);
  });

  it("quick filter etiketleri Türkçe", () => {
    assert.equal(POS_QUICK_FILTER_LABELS.all, "Tümü");
    assert.equal(POS_QUICK_FILTER_LABELS.in_stock, "Stokta olanlar");
  });
});

describe("pos ui dashboard design", () => {
  it("ürün kartı Sepete Ekle butonu içerir", () => {
    const grid = read("components/pos/pos-product-grid.tsx");
    assert.match(grid, /Sepete Ekle/);
    assert.match(grid, /POS_PRODUCT_CARD_CLASS/);
    assert.match(grid, /Stok yok/);
  });

  it("ödeme modalı Satışı Onayla içerir", () => {
    const modal = read("components/pos/pos-payment-modal.tsx");
    assert.match(modal, /Ödeme Al/);
    assert.match(modal, /Satışı Onayla/);
    assert.match(modal, /Para üstü/);
  });

  it("POS ana sayfa hero ve StatCard kullanır", () => {
    const page = read("app/pos/page.tsx");
    assert.match(page, /Hızlı Satış/);
    assert.match(page, /StatCard/);
    assert.match(page, /POS_HERO_CLASS/);
  });

  it("POS_STAFF header çıkış butonu içerir", () => {
    const header = read("components/pos/pos-staff-header.tsx");
    assert.match(header, /Çıkış/);
    assert.doesNotMatch(header, /\/dashboard/);
  });

  it("POS_STAFF için dashboard linki gizlenir", () => {
    const page = read("app/pos/page.tsx");
    assert.match(page, /isPosStaff/);
    assert.match(page, /PosStaffHeader/);
  });
});

describe("POS_STAFF access", () => {
  it("POS_STAFF yalnızca pos modülüne erişir", () => {
    assert.equal(canAccessModule("POS_STAFF", "pos"), true);
    assert.equal(canAccessModule("POS_STAFF", "dashboard"), false);
    assert.equal(canAccessModule("POS_STAFF", "reports"), false);
    assert.deepEqual(getAccessibleModules("POS_STAFF"), ["pos"]);
  });

  it("POS_STAFF giriş sonrası /pos yönlendirmesi", () => {
    assert.equal(getPostAuthRedirectPath("POS_STAFF"), "/pos");
  });
});

describe("POS checkout employee linkage", () => {
  it("checkout servisi userId ile satış oluşturur", () => {
    const service = read("lib/pos-checkout-service.ts");
    assert.match(service, /userId,/);
    assert.match(service, /sourceChannel: "POS"/);
  });
});
