/**
 * Panel/dashboard 500 kilitlenmesi güvenlik regresyon testleri — kaynak
 * tarama. DB gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi
 * çalıştırılmadı; bu dosyadaki testler kaynak tarama/unit'tir).
 *
 * Kök neden: getDefaultMembershipPlan() ("standard" plan katalogda yoksa)
 * throw ediyordu; ensureCompanySubscription bunu yakalamadan dışarı
 * fırlatıyordu; AppShell (her sayfada render edilen ortak layout) ve
 * dashboard/page.tsx bunu try/catch'siz çağırıyordu -> tüm panel 500.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const MEMBERSHIP_SERVICE_PATH = "lib/membership-service.ts";
const APP_SHELL_PATH = "components/layout/app-shell.tsx";
const DASHBOARD_PAGE_PATH = "app/dashboard/page.tsx";

describe("membership panel resilience — kaynak tarama", () => {
  it("getSidebarMembershipSummary artık resolveUserCompanyEntitlementSafe kullanıyor (kullanıcı bazlı, firma değişiminde abonelik korunur), throw eden ensureCompanySubscription'ı doğrudan çağırmıyor", async () => {
    const content = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getSidebarMembershipSummary");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes("resolveUserCompanyEntitlementSafe({ companyId, userId })"));
    assert.ok(!fnBody.includes("await ensureCompanySubscription(companyId)"));
  });

  it("getMembershipAlertForCompany artık resolveUserCompanyEntitlementSafe kullanıyor ve null döndürebiliyor", async () => {
    const content = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMembershipAlertForCompany");
    const fnBody = content.slice(fnStart, fnStart + 400);
    assert.ok(fnBody.includes("resolveUserCompanyEntitlementSafe({ companyId, userId })"));
    assert.ok(fnBody.includes("if (!subscription) return null;"));
  });

  it("ensureCompanySubscriptionSafe try/catch ile sarmalıyor, hatayı yutuyor (panel çökmesin)", async () => {
    const content = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function ensureCompanySubscriptionSafe");
    const fnBody = content.slice(fnStart, fnStart + 500);
    assert.ok(fnBody.includes("try {"));
    assert.ok(fnBody.includes("return null;"));
  });

  it("getSidebarMembershipSummary subscription yoksa (null) hâlâ geçerli bir summary objesi döner, throw etmez", async () => {
    const content = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getSidebarMembershipSummary");
    const fnBody = content.slice(fnStart, fnStart + 700);
    assert.ok(fnBody.includes('status: "UNKNOWN"'));
    assert.ok(fnBody.includes("Kurulum bekleniyor"));
  });

  it("AppShell (her panel sayfasında ortak render edilen layout) getSidebarMembershipSummary'yi doğrudan (guardsız) çağırıyor — artık güvenli çünkü servis kendi içinde hatayı yutuyor", async () => {
    const content = await fs.readFile(APP_SHELL_PATH, "utf8");
    assert.ok(content.includes("getSidebarMembershipSummary("));
  });

  it("dashboard/page.tsx getMembershipAlertForCompany'yi çağırıyor — artık güvenli çünkü servis kendi içinde hatayı yutuyor", async () => {
    const content = await fs.readFile(DASHBOARD_PAGE_PATH, "utf8");
    assert.ok(content.includes("getMembershipAlertForCompany(company.id, user.id)"));
  });

  it("hata olduğunda companyId ile structured log yazılıyor, ham hata mesajı kullanıcıya dönmüyor", async () => {
    const content = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("async function ensureCompanySubscriptionSafe");
    const fnBody = content.slice(fnStart, fnStart + 500);
    assert.ok(fnBody.includes("MEMBERSHIP_SUBSCRIPTION_RESOLVE_FAILED"));
    assert.ok(fnBody.includes("companyId,"));
  });
});

describe("createCompanyForUser — plan kodu tekilliği", () => {
  it("DEFAULT_MEMBERSHIP_PLAN_CODE tek yerde tanımlı (lib/billing/membership-plan-constants.ts), membership-service.ts re-export ediyor, create-company-service.ts onu import ediyor — ayrı bir plan kodu literal'i tekrarlanmıyor", async () => {
    const constantsContent = await fs.readFile("lib/billing/membership-plan-constants.ts", "utf8");
    assert.ok(constantsContent.includes('export const DEFAULT_MEMBERSHIP_PLAN_CODE = "standard"'));

    const membershipContent = await fs.readFile(MEMBERSHIP_SERVICE_PATH, "utf8");
    assert.ok(membershipContent.includes("DEFAULT_MEMBERSHIP_PLAN_CODE"));

    const bootstrapContent = await fs.readFile("lib/create-company-service.ts", "utf8");
    assert.ok(bootstrapContent.includes('import { DEFAULT_MEMBERSHIP_PLAN_CODE } from "@/lib/membership-service"'));
    assert.ok(!bootstrapContent.includes('"standard"'), "create-company-service.ts kendi plan kodu literal'ini tanımlamamalı");
  });

  it("plan bulunamazsa createCompanyForUser hata fırlatmıyor, kayıt akışı tamamlanıyor (subscription eksik kalır ama company oluşur)", async () => {
    const content = await fs.readFile("lib/create-company-service.ts", "utf8");
    const fnStart = content.indexOf("const defaultPlan = await tx.membershipPlan.findFirst");
    const fnBody = content.slice(fnStart, fnStart + 500);
    assert.ok(fnBody.includes("if (defaultPlan) {"));
    assert.ok(fnBody.includes("COMPANY_BOOTSTRAP_DEFAULT_PLAN_MISSING"));
  });
});
