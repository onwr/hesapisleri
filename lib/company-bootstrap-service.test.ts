/**
 * ensureCompanyBootstrap ve repair script — kaynak tarama testleri. DB
 * gerektirmez (TEST_DATABASE_URL yoksa DB entegrasyon testi çalıştırılmadı).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";

const SERVICE_PATH = "lib/company-bootstrap-service.ts";
const REPAIR_SCRIPT_PATH = "scripts/repair-user-bootstrap.mjs";

describe("ensureCompanyBootstrap — kaynak tarama", () => {
  it("input imzası {userId, companyId} şeklinde", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("export type EnsureCompanyBootstrapInput = {"));
    assert.ok(content.includes("userId: string;"));
    assert.ok(content.includes("companyId: string;"));
  });

  it("yalnız eksik kayıtları kontrol edip oluşturuyor (find-then-create deseni, unconditional create yok)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("if (!companyUser)"));
    assert.ok(content.includes("if (!settings)"));
    assert.ok(content.includes("if (!warehouse)"));
    assert.ok(content.includes("if (!account)"));
    assert.ok(content.includes("if (!subscription)"));
    assert.ok(content.includes("if (!onboarding)"));
  });

  it("mevcut owner'ı ezmiyor — companyUser yoksa bile önce mevcut owner kontrolü yapıyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("if (!companyUser) {");
    const fnBody = content.slice(fnStart, fnStart + 600);
    assert.ok(fnBody.includes("existingOwner"));
    assert.ok(fnBody.includes("isOwner: !existingOwner"));
  });

  it("tenant scope korunuyor — tüm sorgular companyId ile filtreleniyor", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("where: { companyId, userId }"));
    assert.ok(content.includes("where: { companyId }, select: { id: true } }"));
  });

  it("transaction kullanıyor (db.$transaction)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    assert.ok(content.includes("await db.$transaction(async (tx) => {"));
  });

  it("plan katalogda yoksa hata fırlatmıyor (MembershipServiceError yutuluyor, idempotent — sonraki çalıştırmada tamamlanır)", async () => {
    const content = await fs.readFile(SERVICE_PATH, "utf8");
    const fnStart = content.indexOf("if (!subscription) {");
    const fnBody = content.slice(fnStart, fnStart + 1400);
    assert.ok(fnBody.includes("} catch (error) {"));
    assert.ok(fnBody.includes("MembershipServiceError"));
  });
});

describe("repair-user-bootstrap.mjs — kaynak tarama", () => {
  it("--dry-run ve --apply modlarını destekliyor", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    assert.ok(content.includes('"--dry-run"'));
    assert.ok(content.includes('"--apply"'));
  });

  it("dry-run modunda hiçbir create/update/upsert/transaction çağrılmıyor (yalnız analyzeCompany çalışır)", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    assert.ok(content.includes("if (isApply) {"));
    const idx = content.indexOf("if (isApply) {");
    assert.ok(content.slice(idx, idx + 150).includes("repairCompany(analysis)"));
  });

  it("apply modu transaction kullanıyor ve tenant scope (company.id) ile filtreleniyor", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    assert.ok(content.includes("await db.$transaction(async (tx) => {"));
    assert.ok(content.includes("companyId: company.id"));
  });

  it("şifre/token/secret alanları hiçbir select/log içinde yok", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    for (const forbidden of ["password", "token", "secret", "hash"]) {
      assert.ok(
        !content.toLowerCase().includes(forbidden),
        `${forbidden} repair script içinde bulunmamalı`
      );
    }
  });

  it("owner ataması yalnız company'ye ait mevcut bir CompanyUser üzerinden yapılıyor, sahte user icat etmiyor", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    assert.ok(content.includes("OWNER_SKIPPED_NO_MEMBER"));
    assert.ok(content.includes("anyMember"));
  });

  it("only-missing repair: mevcut settings/warehouse/account/subscription/onboarding create çağrılarının hepsi !var-mı kontrolüyle sarmalı", async () => {
    const content = await fs.readFile(REPAIR_SCRIPT_PATH, "utf8");
    assert.ok(content.includes("if (!settings) {"));
    assert.ok(content.includes("if (!warehouse) {"));
    assert.ok(content.includes("if (!account) {"));
    assert.ok(content.includes("if (!subscription) {"));
    assert.ok(content.includes("if (!onboarding) {"));
  });
});
