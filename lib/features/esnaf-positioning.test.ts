import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isMarketplaceFeatureEnabled } from "@/lib/features/marketplace-feature";
import {
  getSidebarVisibleHrefs,
  getSidebarVisibleLinkTitles,
} from "@/lib/sidebar-menu";

const webRoot = join(process.cwd());

function read(relativePath: string) {
  return readFileSync(join(webRoot, relativePath), "utf8");
}

describe("esnaf odaklı ürün konumlandırma", () => {
  it("MARKETPLACE_FEATURE_ENABLED default kapalı", () => {
    assert.equal(isMarketplaceFeatureEnabled({}), false);
  });

  it("sidebar default E-Ticaret / sipariş menüsü göstermez", () => {
    const titles = getSidebarVisibleLinkTitles("OWNER", true, {
      marketplaceEnabled: false,
    });
    assert.ok(!titles.includes("Siparişler"));
    assert.ok(!titles.includes("Pazaryeri Entegrasyonları"));
    assert.ok(!titles.some((t) => /E-Ticaret|Trendyol|Hepsiburada/i.test(t)));
  });

  it("sidebar esnaf sırası korunur", () => {
    const hrefs = getSidebarVisibleHrefs("OWNER", true, {
      marketplaceEnabled: false,
    });
    assert.deepEqual(
      [
        hrefs.indexOf("/dashboard"),
        hrefs.indexOf("/pos"),
        hrefs.indexOf("/sales"),
        hrefs.indexOf("/customers"),
        hrefs.indexOf("/products"),
        hrefs.indexOf("/invoices"),
        hrefs.indexOf("/cash-bank"),
        hrefs.indexOf("/expenses"),
        hrefs.indexOf("/suppliers"),
        hrefs.indexOf("/team"),
        hrefs.indexOf("/reports"),
        hrefs.indexOf("/settings"),
      ].every((v, i, arr) => i === 0 || v > arr[i - 1]),
      true
    );
  });

  it("orders layout feature kapalıyken dashboard'a yönlendirir", () => {
    const layout = read("app/orders/layout.tsx");
    assert.match(layout, /isMarketplaceFeatureEnabled/);
    assert.match(layout, /redirect\("\/dashboard"\)/);
  });

  it("dashboard POS CTA'ları içerir", () => {
    const dash = read("components/dashboard/dashboard-content.tsx");
    assert.match(dash, /Satış Yap/);
    assert.match(dash, /Barkodla Satış/);
    assert.match(dash, /Yeni Fatura/);
    assert.match(dash, /href: "\/pos"/);
  });

  it("POS barkod focus query param destekler", () => {
    const pos = read("app/pos/page.tsx");
    assert.match(pos, /useSearchParams/);
    assert.match(pos, /focus.*barcode|get\("focus"\)/);
  });

  it("flag açıkken marketing pazaryeri modülü kaynakta kalır", () => {
    const mod = read("components/marketing/modules-section.tsx");
    assert.match(mod, /Pazaryeri Yönetimi/);
    assert.match(mod, /isMarketplaceFeatureEnabled/);
  });

  it("public hero e-ticaret vaadi içermez", () => {
    const hero = read("components/marketing/hero-section.tsx");
    assert.doesNotMatch(hero, /e-ticaret|pazaryeri|Trendyol|Hepsiburada/i);
    assert.match(hero, /esnaf ve küçük işletmeler/i);
  });

  it("homepage metadata esnaf konumlandırması kullanır", () => {
    const page = read("app/page.tsx");
    assert.match(page, /POS, stok, cari hesap/);
    assert.doesNotMatch(page, /Trendyol, Hepsiburada/);
  });

  it("settings integrations pazaryeri kartlarını flag ile gizler", () => {
    const center = read(
      "components/settings/integrations/integrations-center.tsx"
    );
    assert.match(center, /marketplaceFeatureEnabled/);
    assert.match(center, /MarketplaceIntegrationCard/);
  });
});
