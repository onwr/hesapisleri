/**
 * QA Faz 5B — davranış/regresyon testleri (DB gerektirmez)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const webRoot = join(process.cwd());

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

describe("Faz 5B — negatif ürün fiyatı", () => {
  it("canonical product price validation modülü kullanılır", () => {
    assert.match(readSrc("lib/product-form-utils.ts"), /product-price-validation/);
    assert.match(readSrc("app/api/products/create/route.ts"), /productFormSchema/);
  });

  it("parseProductMoneyInput negatif değeri clamp etmez", () => {
    assert.match(readSrc("lib/money-input-utils.ts"), /throw new Error/);
    assert.match(readSrc("lib/money-input-utils.ts"), /parseProductPriceInput/);
  });
});

describe("Faz 5B — AI CSS sızıntısı", () => {
  it("insight badge metin olarak render edilmez", () => {
    const page = readSrc("app/ai-assistant/page.tsx");
    assert.ok(!page.includes("{insight.badge}"));
    assert.match(page, /badgeLabel/);
    assert.match(page, /AI_INSIGHT_SEVERITY_STYLES/);
  });

  it("dashboard panel structured message kullanır", () => {
    const panel = readSrc("components/dashboard/dashboard-ai-assistant-panel.tsx");
    assert.match(panel, /AiStructuredMessage/);
  });
});

describe("Faz 5B — üyelik tarih DTO", () => {
  it("membership-service canonical display helper kullanır", () => {
    const src = readSrc("lib/membership-service.ts");
    assert.match(src, /buildCanonicalMembershipDisplay/);
    assert.match(src, /resolveMembershipDisplaySafe/);
  });

  it("billing ve sidebar primary date label kullanır", () => {
    assert.match(readSrc("components/settings/membership-billing-panel.tsx"), /primaryDateLabel/);
    assert.match(readSrc("components/layout/app-sidebar.tsx"), /primaryDateLabel/);
  });
});

describe("Faz 5B — tedarikçi durum", () => {
  it("supplier status view helper bağlı", () => {
    assert.match(readSrc("lib/suppliers-page-utils.ts"), /supplier-status-view/);
    assert.match(readSrc("components/suppliers/supplier-detail-client.tsx"), /buildSupplierStatusView/);
  });

  it('SETTLED etiketi "Hesap Kapalı" değil', () => {
    assert.match(readSrc("lib/supplier-balance-utils.ts"), /Bakiye Yok/);
    assert.ok(!readSrc("lib/supplier-balance-utils.ts").includes('SETTLED: "Hesap Kapalı"'));
  });
});

describe("Faz 5B — çalışan istatistikleri", () => {
  it("team summary helper employee-service'te kullanılır", () => {
    assert.match(readSrc("lib/employee-service.ts"), /buildCanonicalTeamSummary/);
    assert.match(readSrc("components/team/team-shell.tsx"), /Henüz çalışan eklenmedi/);
  });

  it("pending metrikler yalnız ACTIVE ve ON_LEAVE çalışanları kapsar", () => {
    const src = readSrc("lib/team-summary.ts");
    assert.match(src, /OPERATIONAL_STATUSES/);
    assert.match(src, /"ACTIVE"/);
    assert.match(src, /"ON_LEAVE"/);
    assert.match(src, /pendingLeaves/);
    assert.match(src, /pendingPayments/);
  });
});

describe("Faz 5B.1 — negatif fiyat mutation yüzeyleri", () => {
  it("create ve update API productFormSchema kullanır", () => {
    assert.match(readSrc("app/api/products/create/route.ts"), /productFormSchema/);
    assert.match(readSrc("app/api/products/[id]/route.ts"), /productUpdateSchema/);
  });

  it("supplier product schema canonical price kullanır", () => {
    assert.match(readSrc("lib/supplier-utils.ts"), /canonicalProductPriceSchema/);
  });

  it("mobile product API aynı schema'yı kullanır", () => {
    assert.match(readSrc("lib/mobile/mobile-products-service.ts"), /productFormSchema/);
  });
});

describe("Faz 5B.1 — üyelik tarih web yüzeyleri", () => {
  it("billing, sidebar ve dashboard canonical DTO/helper kullanır", () => {
    assert.match(readSrc("components/settings/membership-billing-panel.tsx"), /primaryDateLabel/);
    assert.match(readSrc("components/layout/app-sidebar.tsx"), /primaryDateLabel/);
    assert.match(readSrc("lib/membership-service.ts"), /resolveMembershipDisplaySafe/);
    assert.match(readSrc("app/dashboard/page.tsx"), /getMembershipAlertForCompany/);
  });
});
