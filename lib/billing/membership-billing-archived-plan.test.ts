/**
 * Aktif abonelik + arşivlenmiş plan senaryoları — kaynak tarama testleri.
 * DB gerektirmez.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// ─── 1. Billing resolver ──────────────────────────────────────────────────────

describe("billing resolver — arşivlenmiş plan", () => {
  it("getMembershipBillingData Promise.all içinde getDefaultMembershipPlan çağırmıyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");

    // getMembershipBillingData fonksiyonunun gövdesini çıkar.
    // "createMembershipPayment" bir sonraki export — ensureCompanySubscription değil.
    const fnStart = content.indexOf("export async function getMembershipBillingData");
    const fnEnd = content.indexOf("export async function createMembershipPayment");
    const fnBody = content.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);

    // subscription.plan doğrudan kullanılmalı (arşivlenmişse throw etmez) —
    // ayrı bir kod-bazlı katalog planı arama fallback'i artık yok, bkz.
    // membership-billing-canonical-plan.test.ts
    assert.ok(
      fnBody.includes("const subscriptionPlan = subscription.plan;"),
      "getMembershipBillingData, subscription.plan'ı doğrudan kullanmalı"
    );
    // getDefaultMembershipPlan gerçek kod satırlarında ÇAĞRILMAMALI (yorum satırları hariç)
    const codeLines = fnBody.split("\n").filter((l) => !l.trimStart().startsWith("//"));
    const codeBody = codeLines.join("\n");
    assert.ok(
      !codeBody.includes("getDefaultMembershipPlan()"),
      "getMembershipBillingData, getDefaultMembershipPlan() çağırmamalı — arşivlenmişse throw eder"
    );
  });

  it("ayrı kod-bazlı katalog planı arama fallback'i kaldırıldı", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    assert.ok(
      !content.includes("getCatalogPlanForBilling"),
      "getCatalogPlanForBilling helper'ı — kod eşleşmesi (standard/standart) yanlış plana düşme riski nedeniyle — kaldırılmalı"
    );
  });

  it("billing response isOnArchivedPlan alanı içeriyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    assert.ok(
      content.includes("isOnArchivedPlan"),
      "isOnArchivedPlan response alanı mevcut olmalı"
    );
  });

  it("subscription.plan arşivlenmişse bile kullanılır (status filtresi yok)", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    // Kod bazlı ayrı katalog planı arama fallback'i kaldırıldı (bkz.
    // membership-billing-canonical-plan.test.ts) — isOnArchivedPlan artık
    // doğrudan subscriptionPlan.planStatus === "ARCHIVED" kontrolüyle hesaplanıyor,
    // bu da subscription.plan'ı statüsü ne olursa olsun kullanır.
    assert.ok(
      content.includes('const isOnArchivedPlan = subscriptionPlan.planStatus === "ARCHIVED";'),
      "isOnArchivedPlan subscriptionPlan relation'ından hesaplanmalı"
    );
  });

  it("getDefaultMembershipPlan checkout için planStatus:ACTIVE şartını koruyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    // getDefaultMembershipPlan fonksiyonu hâlâ ACTIVE filtresi içermeli
    const fnStart = content.indexOf("export async function getDefaultMembershipPlan");
    const fnEnd = content.indexOf("\nexport async function", fnStart + 1);
    const fnBody = fnStart === -1 ? "" : content.slice(fnStart, fnEnd === -1 ? fnStart + 500 : fnEnd);
    assert.ok(
      fnBody.includes('planStatus: "ACTIVE"'),
      "getDefaultMembershipPlan hâlâ planStatus:ACTIVE zorunlu kılmalı (checkout güvenliği)"
    );
  });

  it("ensureCompanySubscription arşivlenmişse throw etmez (subscription.plan include)", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    const fnStart = content.indexOf("export async function ensureCompanySubscription");
    const fnEnd = content.indexOf("\nexport async function", fnStart + 1);
    const fnBody = fnStart === -1 ? "" : content.slice(fnStart, fnEnd === -1 ? fnStart + 1000 : fnEnd);
    assert.ok(
      fnBody.includes("include: { plan: true }"),
      "ensureCompanySubscription plan'ı include etmeli"
    );
  });
});

// ─── 2. Entitlement resolution ────────────────────────────────────────────────

describe("entitlement resolution — arşivlenmiş plan", () => {
  it("loadResolutionContext planStatus filtresi uygulamıyor", async () => {
    const content = await fs.readFile(
      "lib/billing/entitlements/entitlement-resolution-service.ts",
      "utf8"
    );
    // loadResolutionContext içinde planStatus: "ACTIVE" şartı olmamalı
    const fnStart = content.indexOf("async function loadResolutionContext");
    const fnEnd = content.indexOf("\nasync function", fnStart + 1);
    const fnBody = fnStart === -1 ? "" : content.slice(fnStart, fnEnd === -1 ? fnStart + 2000 : fnEnd);
    assert.ok(
      !fnBody.includes('planStatus: "ACTIVE"'),
      "loadResolutionContext planStatus filtresi uygulamamamalı"
    );
    assert.ok(
      fnBody.includes("plan: {") || fnBody.includes("plan:"),
      "plan entitlements include edilmeli"
    );
  });

  it("entitlement service subscription planStatus'e göre filtre yapmıyor", async () => {
    const content = await fs.readFile(
      "lib/billing/entitlements/entitlement-resolution-service.ts",
      "utf8"
    );
    assert.ok(
      !content.includes('plan: { where: { planStatus'),
      "plan include'da planStatus where şartı olmamalı"
    );
  });
});

// ─── 3. Billing panel ─────────────────────────────────────────────────────────

describe("billing panel — arşivlenmiş plan bildirimi", () => {
  it("BillingData tipi isOnArchivedPlan içeriyor", async () => {
    const content = await fs.readFile(
      "components/settings/membership-billing-panel.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("isOnArchivedPlan"),
      "BillingData tipi ve UI isOnArchivedPlan içermeli"
    );
  });

  it("arşivlenmiş plan bildirimi Türkçe mesaj içeriyor", async () => {
    const content = await fs.readFile(
      "components/settings/membership-billing-panel.tsx",
      "utf8"
    );
    assert.ok(
      content.includes("yeni satışlara kapatılmıştır"),
      "arşivlenmiş plan kullanıcıya Türkçe bildirilmeli"
    );
    assert.ok(
      content.includes("Mevcut aboneliğiniz etkilenmez"),
      "mevcut aboneliğin etkilenmediği belirtilmeli"
    );
  });

  it("'Aktif üyelik paketi bulunamadı' sadece gerçekten membership yoksa gösterilir", async () => {
    // billing panel 'Aktif üyelik paketi bulunamadı' mesajını error state'den alıyor
    // API artık throw etmediğinden bu mesaj görünmemeli (abonelik varsa)
    const content = await fs.readFile(
      "components/settings/membership-billing-panel.tsx",
      "utf8"
    );
    // Panel error state'i json.message'dan alıyor — API artık billing durumunda throw etmiyor
    assert.ok(
      content.includes("json.message"),
      "hata mesajı API'dan alınmalı (hardcoded olmamalı)"
    );
  });
});

// ─── 4. Admin plan cache ──────────────────────────────────────────────────────

describe("plan arşivleme cache yönetimi", () => {
  it("plan arşivlenirken checkout-plan cache'i temizleniyor", async () => {
    const content = await fs.readFile(
      "lib/admin/plans/admin-plan-cache.ts",
      "utf8"
    );
    assert.ok(
      content.includes("checkout-plan"),
      "arşivleme checkout-plan cache tag'ini temizlemeli"
    );
  });

  it("archiveAdminPlan invalidateAdminPlanCaches çağırıyor", async () => {
    const content = await fs.readFile(
      "lib/admin/plans/admin-plan-action-service.ts",
      "utf8"
    );
    // archiveAdminPlan fonksiyonu
    const fnStart = content.indexOf("export async function archiveAdminPlan");
    const fnEnd = content.indexOf("\nexport async function", fnStart + 1);
    const fnBody = fnStart === -1 ? "" : content.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
    assert.ok(
      fnBody.includes("invalidateAdminPlanCaches"),
      "arşivleme sonrası invalidateAdminPlanCaches çağrılmalı"
    );
  });

  it("billing service entitlement cache key'i Sipay içermiyor", async () => {
    const content = await fs.readFile(
      "lib/billing/entitlements/entitlement-cache.ts",
      "utf8"
    );
    assert.ok(!content.toLowerCase().includes("sipay"), "entitlement cache Sipay referansı içermemeli");
  });
});

// ─── 5. Tenant izolasyon ─────────────────────────────────────────────────────

describe("billing — tenant izolasyonu", () => {
  it("getMembershipBillingData assertCompanyAccess çağırıyor", async () => {
    const content = await fs.readFile("lib/membership-service.ts", "utf8");
    const fnStart = content.indexOf("export async function getMembershipBillingData");
    const fnEnd = content.indexOf("\nexport async function", fnStart + 1);
    const fnBody = fnStart === -1 ? "" : content.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
    assert.ok(
      fnBody.includes("assertCompanyAccess"),
      "tenant erişim kontrolü zorunlu"
    );
  });

  it("companyId session'dan alınıyor, body'den değil", async () => {
    const content = await fs.readFile(
      "app/api/membership/billing/route.ts",
      "utf8"
    );
    assert.ok(
      content.includes("session.company.id"),
      "companyId session'dan alınmalı"
    );
    assert.ok(
      !content.includes("body.companyId"),
      "companyId body'den alınmamalı"
    );
  });
});

// ─── 6. Public plan service — checkout filtresi korunuyor ────────────────────

describe("public plan service — checkout filtresi", () => {
  it("getPublicPlans hâlâ planStatus:ACTIVE filtresi uyguluyor", async () => {
    const content = await fs.readFile(
      "lib/marketing/public-plan-service.ts",
      "utf8"
    );
    assert.ok(
      content.includes('planStatus: "ACTIVE"'),
      "checkout/katalog listesi yalnız ACTIVE planları göstermeli"
    );
    assert.ok(
      content.includes('visibility: "PUBLIC"'),
      "checkout listesi yalnız PUBLIC planları göstermeli"
    );
  });
});
