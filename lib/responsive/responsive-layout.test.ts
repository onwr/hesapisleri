/**
 * Responsive layout testleri — kaynak tarama.
 * DB veya browser gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// ─── 1. Mobile sidebar ────────────────────────────────────────────────────────

describe("mobile sidebar", () => {
  it("sidebar-context mobileOpen/openMobile/closeMobile export eder", async () => {
    const content = await fs.readFile(
      "components/layout/sidebar-context.tsx",
      "utf8"
    );
    assert.ok(content.includes("mobileOpen"), "mobileOpen state gerekli");
    assert.ok(content.includes("openMobile"), "openMobile fonksiyonu gerekli");
    assert.ok(content.includes("closeMobile"), "closeMobile fonksiyonu gerekli");
  });

  it("app-topbar hamburger butonu içeriyor", async () => {
    const content = await fs.readFile(
      "components/layout/app-topbar.tsx",
      "utf8"
    );
    assert.ok(content.includes("openMobile"), "topbar openMobile çağrılmalı");
    assert.ok(content.includes("Menu"), "hamburger icon (Menu) kullanılmalı");
    assert.ok(content.includes("lg:hidden"), "hamburger mobilde görünür, lg'de gizli");
    assert.ok(content.includes("aria-label"), "hamburger butonun aria-label'ı olmalı");
  });

  it("app-sidebar mobil overlay render ediyor", async () => {
    const content = await fs.readFile(
      "components/layout/app-sidebar.tsx",
      "utf8"
    );
    assert.ok(content.includes("mobileOpen"), "mobileOpen ile overlay tetiklenmeli");
    assert.ok(content.includes("closeMobile"), "overlay tıklandığında kapanmalı");
    assert.ok(content.includes("lg:hidden"), "mobil overlay masaüstünde gizli olmalı");
    assert.ok(content.includes("z-[3"), "overlay için yeterli z-index gerekli");
    assert.ok(content.includes("backdrop"), "overlay backdrop/blur içermeli");
  });

  it("pathname değişince mobile sidebar kapanır", async () => {
    const content = await fs.readFile(
      "components/layout/app-sidebar.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("closeMobile") && content.includes("pathname"),
      "pathname değişince closeMobile çağrılmalı"
    );
  });
});

// ─── 2. Topbar responsive ──────────────────────────────────────────────────────

describe("topbar responsive", () => {
  it("topbar min-w-0 ile taşmayı önler", async () => {
    const content = await fs.readFile(
      "components/layout/app-topbar.tsx",
      "utf8"
    );
    assert.ok(content.includes("min-w-0"), "başlık div'i min-w-0 içermeli");
    assert.ok(content.includes("truncate"), "uzun ad truncate ile kırpılmalı");
  });

  it("topbar safe-area veya responsive padding kullanıyor", async () => {
    const content = await fs.readFile(
      "components/layout/app-topbar.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("px-4") || content.includes("sm:px-"),
      "mobil için daha dar padding olmalı"
    );
  });
});

// ─── 3. Responsive page header ────────────────────────────────────────────────

describe("responsive-page-header component", () => {
  it("bileşen dosyası mevcut", async () => {
    await assert.doesNotReject(
      fs.access("components/layout/responsive-page-header.tsx")
    );
  });

  it("masaüstü için yan yana, mobil için alt alta düzen", async () => {
    const content = await fs.readFile(
      "components/layout/responsive-page-header.tsx",
      "utf8"
    );
    assert.ok(content.includes("flex-col"), "mobilde dikey düzen");
    assert.ok(content.includes("sm:flex-row"), "sm ve üzerinde yatay düzen");
  });

  it("başlık truncate ile taşmayı önler", async () => {
    const content = await fs.readFile(
      "components/layout/responsive-page-header.tsx",
      "utf8"
    );
    assert.ok(content.includes("truncate"), "başlık truncate içermeli");
  });
});

// ─── 4. Mobile filter sheet ───────────────────────────────────────────────────

describe("mobile-filter-sheet component", () => {
  it("bileşen dosyası mevcut", async () => {
    await assert.doesNotReject(
      fs.access("components/layout/mobile-filter-sheet.tsx")
    );
  });

  it("85dvh veya 90dvh kullanıyor", async () => {
    const content = await fs.readFile(
      "components/layout/mobile-filter-sheet.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("dvh"),
      "mobile filter sheet dvh kullanmalı"
    );
  });

  it("aktif filtre badge gösteriyor", async () => {
    const content = await fs.readFile(
      "components/layout/mobile-filter-sheet.tsx",
      "utf8"
    );
    assert.ok(content.includes("activeFilterCount"), "aktif filtre sayısı gösterilmeli");
  });

  it("uygula ve temizle butonları var", async () => {
    const content = await fs.readFile(
      "components/layout/mobile-filter-sheet.tsx",
      "utf8"
    );
    assert.ok(content.includes("Uygula"), "Uygula butonu gerekli");
    assert.ok(content.includes("Temizle"), "Temizle butonu gerekli");
  });

  it("safe-area-inset-bottom destekli", async () => {
    const content = await fs.readFile(
      "components/layout/mobile-filter-sheet.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("safe-area-inset-bottom"),
      "iphone notch için safe-area desteği gerekli"
    );
  });
});

// ─── 5. Modal max-height ─────────────────────────────────────────────────────

describe("modal mobile max-height", () => {
  it("invoice-collect-modal max-h dvh içeriyor", async () => {
    const content = await fs.readFile(
      "components/invoices/invoice-collect-modal.tsx",
      "utf8"
    );
    assert.ok(content.includes("max-h-[90dvh]"), "90dvh ile viewport taşması önlenmeli");
    assert.ok(content.includes("overflow-y-auto") || content.includes("overflow-hidden"), "scroll desteği olmalı");
  });

  it("expense-pay-modal max-h dvh içeriyor", async () => {
    const content = await fs.readFile(
      "components/expenses/expense-pay-modal.tsx",
      "utf8"
    );
    assert.ok(content.includes("max-h-[90dvh]"), "90dvh ile viewport taşması önlenmeli");
  });

  it("sale-collect-modal max-h dvh içeriyor", async () => {
    const content = await fs.readFile(
      "components/sales/sale-collect-modal.tsx",
      "utf8"
    );
    assert.ok(content.includes("max-h-[90dvh]"), "90dvh ile viewport taşması önlenmeli");
  });

  it("customer-finance-modal max-h dvh içeriyor", async () => {
    const content = await fs.readFile(
      "components/customers/customer-finance-modal.tsx",
      "utf8"
    );
    assert.ok(content.includes("max-h-[90dvh]"), "90dvh ile viewport taşması önlenmeli");
  });

  it("stock-movement-modal max-h dvh içeriyor", async () => {
    const content = await fs.readFile(
      "components/stocks/stock-movement-modal.tsx",
      "utf8"
    );
    assert.ok(content.includes("max-h-[90dvh]"), "90dvh ile viewport taşması önlenmeli");
  });
});

// ─── 6. Table overflow kontrolü ──────────────────────────────────────────────

describe("table overflow wrapping", () => {
  it("products-selectable-table overflow-x-auto wrapper içeriyor", async () => {
    const content = await fs.readFile(
      "components/products/products-selectable-table.tsx",
      "utf8"
    );
    assert.ok(content.includes("overflow-x-auto"), "tablo overflow-x-auto ile sarılmalı");
    assert.ok(content.includes("md:hidden"), "mobil kart görünümü olmalı");
  });

  it("warehouse-transfers-tab overflow-x-auto wrapper içeriyor", async () => {
    const content = await fs.readFile(
      "components/warehouses/warehouse-transfers-tab.tsx",
      "utf8"
    );
    assert.ok(content.includes("overflow-x-auto"), "tablo overflow-x-auto içermeli");
  });

  it("team-departments-client overflow-x-auto wrapper içeriyor", async () => {
    const content = await fs.readFile(
      "components/team/team-departments-client.tsx",
      "utf8"
    );
    assert.ok(content.includes("overflow-x-auto"), "tablo overflow-x-auto içermeli");
  });
});

// ─── 7. Floating element çakışması ───────────────────────────────────────────

describe("floating element z-index", () => {
  it("ai-floating-launcher drawer açıkken gizleniyor", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/ai-floating-launcher.tsx",
      "utf8"
    );
    assert.ok(content.includes("state.open"), "drawer açıkken launcher gizlenmeli");
    assert.ok(content.includes("return null"), "gizlenince null döner");
  });

  it("mobile sidebar z-index floating launcher'dan yüksek", async () => {
    const sidebarContent = await fs.readFile(
      "components/layout/app-sidebar.tsx",
      "utf8"
    );
    // Mobile overlay z-[35] veya daha yüksek
    assert.ok(
      sidebarContent.includes("z-[35]") || sidebarContent.includes("z-[36]"),
      "mobil sidebar z-index floating elementlerin üzerinde olmalı"
    );
  });

  it("floating launcher safe-area-inset-bottom kullanıyor", async () => {
    const content = await fs.readFile(
      "components/ai-assistant/ai-floating-launcher.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("safe-area-inset-bottom"),
      "launcher notch için safe-area kullanmalı"
    );
  });
});

// ─── 8. Sipay izolasyonu ─────────────────────────────────────────────────────

describe("responsive — sipay izolasyonu", () => {
  it("sidebar Sipay içermiyor", async () => {
    const content = await fs.readFile(
      "components/layout/app-sidebar.tsx",
      "utf8"
    );
    assert.ok(!content.toLowerCase().includes("sipay"), "sidebar Sipay referansı içermemeli");
  });

  it("topbar Sipay içermiyor", async () => {
    const content = await fs.readFile(
      "components/layout/app-topbar.tsx",
      "utf8"
    );
    assert.ok(!content.toLowerCase().includes("sipay"), "topbar Sipay referansı içermemeli");
  });
});
