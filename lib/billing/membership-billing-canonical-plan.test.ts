/**
 * /settings/billing eski plan + statik fiyat karışması kesin düzeltme testleri.
 * DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/membership-service.ts";
const PANEL_PATH = "components/settings/membership-billing-panel.tsx";
const TARGET_PRICE_UTILS_PATH = "lib/admin/plans/admin-plan-target-price-utils.ts";

describe("billing — tek canonical plan kaynağı", () => {
  it("getCatalogPlanForBilling / kod bazlı katalog arama kaldırıldı", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      !content.includes("getCatalogPlanForBilling"),
      "ayrı bir katalog planı arama mekanizması kalmamalı — kod eşleşmesi (standard vs standart) yanlış plana düşmeye yol açıyordu"
    );
    assert.ok(
      !content.includes("DEFAULT_MEMBERSHIP_PLAN_CODE, planStatus: \"ACTIVE\""),
      "billing planı artık koda göre değil subscription.plan relation'ından gelmeli"
    );
  });

  it("getMembershipBillingData yalnız subscription.plan kullanır", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMembershipBillingData");
    const fnEnd = content.indexOf("export async function createMembershipPayment");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(
      fnBody.includes("const subscriptionPlan = subscription.plan;"),
      "subscriptionPlan doğrudan subscription.plan olmalı"
    );
    assert.ok(
      !fnBody.includes("displayPlan"),
      "ayrı bir displayPlan fallback kavramı kalmamalı"
    );
    assert.ok(
      fnBody.includes("serializeBillingPlan(subscriptionPlan)"),
      "dönen plan DTO'su subscriptionPlan'dan üretilmeli"
    );
  });
});

describe("billing — arşiv uyarısı yalnız gerçek relation'dan hesaplanır", () => {
  it("isOnArchivedPlan yalnız subscriptionPlan.planStatus === ARCHIVED kontrolüne dayanır", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes('const isOnArchivedPlan = subscriptionPlan.planStatus === "ARCHIVED";'),
      "isOnArchivedPlan tek satırlık doğrudan relation kontrolü olmalı"
    );
  });

  it("locked price'ın planı veya eski snapshot isOnArchivedPlan'ı etkilemez", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("const isOnArchivedPlan");
    const fnEnd = content.indexOf("\n", fnStart);
    const line = content.slice(fnStart, fnEnd);
    assert.ok(
      !line.includes("lockedPlanPrice") && !line.includes("archivedPlan"),
      "isOnArchivedPlan hesaplamasında locked price veya ayrı arşiv değişkeni kullanılmamalı"
    );
  });
});

describe("billing — fiyat kaynağı yalnız MembershipPlanPrice", () => {
  it("serializeBillingPlan loadTargetActivePricesByPeriod kullanır (admin/migration ile aynı canonical resolver)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("loadTargetActivePricesByPeriod"),
      "billing fiyatları admin tablo/migration ile aynı paylaşılan resolver'dan gelmeli"
    );
    assert.ok(
      content.includes('from "@/lib/admin/plans/admin-plan-target-price-utils"'),
      "ayrı/çelişkili bir fiyat çözümleme fonksiyonu icat edilmemeli"
    );
  });

  it("serializeBillingPlan legacy monthlyPrice/quarterlyPrice/semiAnnualPrice/yearlyPrice alanlarını kullanmaz", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function serializeBillingPlan");
    const fnEnd = content.indexOf("\nfunction serializePayment");
    const fnBody = content.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
    assert.ok(
      !fnBody.includes("plan.monthlyPrice") &&
        !fnBody.includes("plan.quarterlyPrice") &&
        !fnBody.includes("plan.semiAnnualPrice") &&
        !fnBody.includes("plan.yearlyPrice"),
      "serializeBillingPlan legacy statik fiyat alanlarını okumamalı"
    );
    assert.ok(
      fnBody.includes("salePriceMinor"),
      "fiyatlar MembershipPlanPrice.salePriceMinor üzerinden hesaplanmalı"
    );
  });

  it("admin plan tablosu ile billing aynı canonical price resolver dosyasını paylaşır", async () => {
    const content = await fs.readFile(TARGET_PRICE_UTILS_PATH, "utf8");
    assert.ok(
      content.includes("assertSingleEffectivePrice"),
      "shared resolver checkout/admin ile aynı effective-price fonksiyonunu kullanmalı"
    );
  });
});

describe("statik fiyat fallback kalıntısı yok", () => {
  it("membership-service.ts içinde eski arşivlenmiş plan sabit fiyatları (3999/7499/12999) geçmiyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    for (const literal of ["3999", "7499", "12999"]) {
      assert.ok(!content.includes(literal), `membership-service.ts '${literal}' literalini içermemeli`);
    }
  });

  it("billing paneli statik fiyat objesi içermiyor", async () => {
    const content = await fs.readFile(PANEL_PATH, "utf8");
    for (const literal of ["3999", "7499", "12999"]) {
      assert.ok(!content.includes(literal), `panel '${literal}' literalini içermemeli`);
    }
  });
});

describe("billing — checkout özeti plan tutarlılığı", () => {
  it("panel plan seçim kartı, ödeme özeti ve SipayCheckoutButton aynı data.plan.id/name kaynağını kullanır", async () => {
    const content = await fs.readFile(PANEL_PATH, "utf8");
    assert.ok(content.includes("data.plan.id"), "checkout planId data.plan.id'den gelmeli");
    assert.ok(
      content.includes("data.plan.name"),
      "amountLabel/planName gösterimi data.plan.name kullanmalı"
    );
    // subscription.plan.name (üstteki başlık) ile plan.name (paket seçimi) artık
    // servis tarafında aynı subscriptionPlan'dan üretiliyor — ayrı bir eski plan adı yok.
  });
});

describe("billing — abonelik plan alanları", () => {
  it("subscription.plan artık ayrı bir serializePlan(displayPlan) çağrısına dayanmıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      !content.includes("plan: serializePlan((subscriptionPlan ?? displayPlan)!)"),
      "eski karışık fallback ifadesi kaldırılmalı"
    );
  });

  it("subscriptionPlan yoksa (planId null) açık hata döner, sessizce yanlış plana düşmez", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(
      content.includes("if (!subscriptionPlan) {") &&
        content.includes('"Aktif üyelik paketi bulunamadı."'),
      "plan bulunamadığında açık hata dönmeli, sessiz fallback olmamalı"
    );
  });
});
