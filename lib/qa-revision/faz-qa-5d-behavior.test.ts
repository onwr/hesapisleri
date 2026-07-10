/**
 * QA Faz 5D — davranış/regresyon testleri (DB gerektirmez)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isInternalTestMembershipPlan,
  sanitizeMembershipPlanDisplayName,
} from "@/lib/billing/canonical-plan-display";
import { resolveSaleCustomerDisplay } from "@/lib/orders/sale-customer-display";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5D — fiyatlandırma tek kaynak", () => {
  it("marketing public-plan-service canonical plan display kullanır", () => {
    const src = readSrc("lib/marketing/public-plan-service.ts");
    assert.match(src, /buildCanonicalPlanDisplay/);
    assert.match(src, /platformTrialDays: settings\.trialDays/);
    assert.ok(!src.includes("monthlyPrice: Number(p.monthlyPrice)"));
  });

  it("pricing section yıllık metni showAnnualDiscount ile kontrol edilir", () => {
    const src = readSrc("components/marketing/pricing-section.tsx");
    assert.match(src, /showAnnualDiscount/);
    assert.match(src, /annualEquivalentMonthlyPrice/);
  });

  it("createMembershipPayment resolveSubscriptionPrice kullanır", () => {
    const src = readSrc("lib/membership-service.ts");
    const start = src.indexOf("export async function createMembershipPayment");
    const end = src.indexOf("async function applyPaidMembershipPayment");
    const body = src.slice(start, end);
    assert.match(body, /resolveSubscriptionPrice/);
    assert.match(body, /resolved\.totalMinor \/ 100/);
    assert.ok(!body.includes("calculateMembershipAmount(plan"));
  });

  it("pricing'de TEST plan adı gösterilmez", () => {
    assert.equal(isInternalTestMembershipPlan({ name: "ANA PAKET TEST", code: "X" }), true);
    assert.equal(sanitizeMembershipPlanDisplayName("ANA PAKET TEST"), "ANA PAKET");
  });
});

describe("Faz 5D — oturumlu 404", () => {
  it("not-found authenticated shell kullanır", () => {
    const src = readSrc("app/not-found.tsx");
    assert.match(src, /getOptionalSession/);
    assert.match(src, /isProtectedRoute/);
    assert.match(src, /AppShell/);
    assert.match(src, /AuthenticatedNotFoundPanel/);
  });

  it("public 404 dashboard linki içermez", () => {
    const src = readSrc("components/layout/not-found-panels.tsx");
    const publicBody = src.slice(src.indexOf("export function PublicNotFoundPanel"));
    assert.doesNotMatch(publicBody, /href="\/dashboard"/);
    assert.match(publicBody, /href="\/login"/);
  });

  it("authenticated 404 panele dön linki içerir", () => {
    const src = readSrc("components/layout/not-found-panels.tsx");
    assert.match(src, /href="\/dashboard"/);
    assert.match(src, /Önceki Sayfaya Dön/);
  });

  it("proxy pathname header set eder", () => {
    assert.match(readSrc("proxy.ts"), /x-pathname/);
  });
});

describe("Faz 5D — boş POS sepeti", () => {
  it("checkout butonu boş sepette disabled ve mesaj gösterir", () => {
    const src = readSrc("components/pos/pos-cart-panel.tsx");
    assert.match(src, /cart\.length === 0/);
    assert.match(src, /Satışı tamamlamak için sepete en az bir ürün ekleyin/);
    assert.match(src, /pos-empty-cart-hint/);
  });

  it("F8 boş sepette sepeti temizlemez", () => {
    const src = readSrc("hooks/use-pos-keyboard-shortcuts.ts");
    assert.match(src, /if \(!cartEmpty\) onClearCart\(\)/);
  });

  it("POS API boş items reddeder", () => {
    assert.match(readSrc("lib/pos-checkout-utils.ts"), /min\(1, "En az bir ürün ekleyin."\)/);
  });
});

describe("Faz 5D — marketplace müşteri gösterimi", () => {
  it("orders-page-utils sale customer resolver kullanır", () => {
    assert.match(readSrc("lib/orders-page-utils.ts"), /resolveSaleCustomerDisplay/);
  });

  it("marketplace sync idempotent orderNote helper kullanır", () => {
    assert.match(readSrc("lib/marketplace/marketplace-sync-service.ts"), /buildMarketplaceOrderNote/);
    assert.match(readSrc("lib/marketplace/marketplace-order-note.ts"), /stripMarketplaceSyncMetadata/);
  });

  it("pazaryeri siparişinde Müşteri seçilmedi gösterilmez", () => {
    const display = resolveSaleCustomerDisplay({
      sourceChannel: "TRENDYOL",
      externalOrderId: "1",
      orderNote: "Alıcı: Ali Veli.",
      customer: { name: "Trendyol Müşterileri", phone: null },
    });
    assert.equal(display.customerName, "Ali Veli");
  });
});

describe("Faz 5D — Fihrist / Müşteriler ayrımı", () => {
  it("sidebar hint metinleri tanımlı", () => {
    const src = readSrc("lib/sidebar-menu.ts");
    assert.match(src, /Satış, bakiye ve cari hesap/);
    assert.match(src, /Birleşik iletişim rehberi/);
  });

  it("sayfa başlıkları modül açıklaması içerir", () => {
    assert.match(readSrc("app/customers/page.tsx"), /ResponsivePageHeader/);
    assert.match(readSrc("app/directory/page.tsx"), /birleşik iletişim rehberi/i);
  });
});

describe("Faz 5D — SEO yeniden doğrulama", () => {
  it("robots dashboard disallow içerir", () => {
    assert.match(readSrc("app/robots.ts"), /"\/dashboard"/);
  });

  it("sitemap login/register içermez", () => {
    const src = readSrc("app/sitemap.ts");
    assert.ok(!src.includes('"/login"'));
    assert.ok(!src.includes('"/register"'));
  });
});
