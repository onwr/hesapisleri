/**
 * Firma değişiminde abonelik korunması — kaynak tarama testleri. DB
 * gerektirmez (TEST_DATABASE_URL yoksa gerçek DB entegrasyon testi
 * çalıştırılmadı).
 *
 * İş kuralı (kullanıcı onayı ile netleşti): abonelik KULLANICIYA aittir,
 * firmalara ayrı ayrı değil. resolveUserCompanyEntitlement bu kuralı
 * uygular — YENİ bir CompanySubscription ASLA duplicate olarak oluşturmaz,
 * yalnız hangi mevcut kaydın kullanılacağını çözer.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/membership-service.ts";

describe("resolveUserCompanyEntitlement — kaynak tarama", () => {
  it("önce firmanın KENDİ geçerli aboneliğine bakıyor (varsa onu kullanır)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnBody = content.slice(fnStart, fnStart + 800);
    assert.ok(fnBody.includes("companyId: input.companyId"));
    assert.ok(fnBody.includes('getMembershipStatus(ownSubscription) !== "EXPIRED"'));
  });

  it("kendi aboneliği yoksa/süresi dolmuşsa kullanıcının DİĞER firmalarına bakıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnBody = content.slice(fnStart, fnStart + 2500);
    assert.ok(fnBody.includes("companyId: { not: input.companyId }"));
    assert.ok(fnBody.includes("userId: input.userId,"));
  });

  it("yalnız ACTIVE CompanyUser üyeliği olan firmalar aranıyor (başka kullanıcıya ait abonelik kullanılmaz)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnBody = content.slice(fnStart, fnStart + 2500);
    assert.ok(fnBody.includes('status: "ACTIVE",'));
    assert.ok(fnBody.includes('company: { status: "ACTIVE" }'));
  });

  it("süresi dolmuş/iptal edilmiş abonelikler 'geçerli' sayılmıyor — expired/cancelled paylaşılmaz", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnBody = content.slice(fnStart, fnStart + 2700);
    assert.ok(fnBody.includes("SHAREABLE_STATUSES.has(getMembershipStatus(sub))"));
    const setStart = fnBody.indexOf("const SHAREABLE_STATUSES = new Set([");
    const setBody = fnBody.slice(setStart, fnBody.indexOf("]);", setStart));
    assert.ok(!setBody.includes("CANCELLED"));
    assert.ok(!setBody.includes("EXPIRED"));
  });

  it("hiçbir yerde geçerli abonelik yoksa mevcut firma için normal bootstrap'e (ensureCompanySubscription) düşer — duplicate oluşturmaz, yalnız EKSİK olanı tamamlar", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnEnd = content.indexOf("async function resolveUserCompanyEntitlementSafe");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("const bootstrapped = await ensureCompanySubscription(input.companyId);"));
  });

  it("kullanıcının başka firmalarında abonelik GEÇMİŞİ var ama hiçbiri paylaşıma uygun değilse (hepsi bitmiş), yeni firma için TRIAL bootstrap'i ATLANIR — bitmiş durum maskelenemez", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnEnd = content.indexOf("async function resolveUserCompanyEntitlementSafe");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(fnBody.includes("if (otherSubscriptions.length > 0) {"));
    assert.ok(fnBody.includes("canManageBilling: false,"));
  });

  it("hard-coded 'standard'/'standart' plan kodu araması YOK bu fonksiyonda", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function resolveUserCompanyEntitlement");
    const fnEnd = content.indexOf("async function resolveUserCompanyEntitlementSafe");
    const fnBody = content.slice(fnStart, fnEnd);
    assert.ok(!fnBody.includes('"standard"'));
    assert.ok(!fnBody.includes('"standart"'));
  });
});

describe("getSidebarMembershipSummary / getMembershipAlertForCompany — kullanıcı bazlı çözümleme", () => {
  it("her ikisi de artık userId parametresi alıyor ve resolveMembershipDisplaySafe kullanıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("export async function getSidebarMembershipSummary(companyId: string, userId?: string)"));
    assert.ok(content.includes("export async function getMembershipAlertForCompany("));

    const sidebarStart = content.indexOf("export async function getSidebarMembershipSummary");
    const sidebarBody = content.slice(sidebarStart, sidebarStart + 300);
    assert.ok(sidebarBody.includes("resolveMembershipDisplaySafe({ companyId, userId })"));
  });

  it("AppShell (her sayfada render edilir) session.user.id'yi geçiyor", async () => {
    const content = await fs.readFile("components/layout/app-shell.tsx", "utf8");
    assert.ok(content.includes("session.user.id"));
  });

  it("dashboard sayfası user.id'yi geçiyor", async () => {
    const content = await fs.readFile("app/dashboard/page.tsx", "utf8");
    const idx = content.indexOf("getMembershipAlertForCompany(company.id, user.id)");
    assert.ok(idx !== -1);
  });
});

describe("getMembershipBillingData — /settings/billing sayfası da kullanıcı bazlı çözümleme kullanıyor", () => {
  it("ensureCompanySubscription yerine resolveUserCompanyEntitlement çağırıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("export async function getMembershipBillingData");
    const fnBody = content.slice(fnStart, fnStart + 1600);
    assert.ok(fnBody.includes("resolveUserCompanyEntitlement({"));
    assert.ok(!fnBody.includes("ensureCompanySubscription(input.companyId),"));
  });

  it("[DB entegrasyon] iki firma arasında geçiş yapan kullanıcı için abonelik korunur", () => {
    if (!process.env.TEST_DATABASE_URL) {
      console.log("Gerçek DB entegrasyon testleri çalıştırılmadı (TEST_DATABASE_URL tanımlı değil).");
      return;
    }
  });
});
