import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readFile(...segments: string[]) {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

describe("mail yapılandırması yoksa 503 — token üretilmez", () => {
  it("adminSendUserPasswordReset 503 fırlatır", async () => {
    const { adminSendUserPasswordReset, AdminUserActionError } =
      await import("@/lib/admin/users/admin-user-action-service");
    try {
      await adminSendUserPasswordReset("user-1", "admin-1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminUserActionError);
      assert.equal(e.status, 503);
    }
  });

  it("adminResendVerification 503 fırlatır", async () => {
    const { adminResendVerification, AdminUserActionError } =
      await import("@/lib/admin/users/admin-user-action-service");
    try {
      await adminResendVerification("user-1", "admin-1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminUserActionError);
      assert.equal(e.status, 503);
    }
  });

  it("adminResendMembershipInvite 503 fırlatır", async () => {
    const { adminResendMembershipInvite, AdminUserMembershipError } =
      await import("@/lib/admin/users/admin-user-membership-service");
    try {
      await adminResendMembershipInvite("user-1", "cu-1", "admin-1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminUserMembershipError);
      assert.equal(e.status, 503);
    }
  });

  it("sendOwnerPasswordReset (Faz 2) 503 fırlatır", async () => {
    const { sendOwnerPasswordReset, AdminCompanyActionError } =
      await import("@/lib/admin/companies/admin-company-action-service");
    try {
      await sendOwnerPasswordReset("company-1", "admin-1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminCompanyActionError);
      assert.equal(e.status, 503);
    }
  });

  it("resendOwnerInvite (Faz 2) 503 fırlatır", async () => {
    const { resendOwnerInvite, AdminCompanyActionError } =
      await import("@/lib/admin/companies/admin-company-action-service");
    try {
      await resendOwnerInvite("company-1", "admin-1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminCompanyActionError);
      assert.equal(e.status, 503);
    }
  });

  it("user reset-password servis dosyasında PasswordResetToken.create/upsert yok", () => {
    const source = readFile("lib", "admin", "users", "admin-user-action-service.ts");
    assert.ok(!source.includes("passwordResetToken.create"), "token oluşturulmamalı");
    assert.ok(!source.includes("passwordResetToken.upsert"), "token upsert edilmemeli");
    assert.ok(!source.includes("randomBytes"), "token üretilmemeli");
    assert.ok(!source.includes("createHash"), "hash üretilmemeli");
  });

  it("company action servisinde token oluşturma kodu yok", () => {
    const source = readFile("lib", "admin", "companies", "admin-company-action-service.ts");
    assert.ok(!source.includes("passwordResetToken.create"), "token oluşturulmamalı");
    assert.ok(!source.includes("companyInvite.create"), "davet token'ı oluşturulmamalı");
    assert.ok(!source.includes("randomBytes"), "random bytes kullanılmamalı");
    assert.ok(!source.includes("buildInviteLink"), "link oluşturulmamalı");
  });

  it("user reset route response'unda rawToken veya resetLink yok", () => {
    const source = readFile("app", "api", "admin", "users", "[id]", "reset-password", "route.ts");
    assert.ok(!source.includes("rawToken"), "rawToken response'a girmemeli");
    assert.ok(!source.includes("resetLink"), "resetLink response'a girmemeli");
    assert.ok(!source.includes("token:"), "token response'a girmemeli");
  });

  it("user resend-verification route response'unda token yok", () => {
    const source = readFile(
      "app", "api", "admin", "users", "[id]", "resend-verification", "route.ts"
    );
    assert.ok(!source.includes("rawToken"), "rawToken response'a girmemeli");
    assert.ok(!source.includes("verificationToken"), "verificationToken response'a girmemeli");
  });

  it("membership resend-invite route response'unda token yok", () => {
    const source = readFile(
      "app", "api", "admin", "users", "[id]", "memberships", "[companyUserId]", "resend-invite", "route.ts"
    );
    assert.ok(!source.includes("inviteToken"), "inviteToken response'a girmemeli");
    assert.ok(!source.includes("rawToken"), "rawToken response'a girmemeli");
  });

  it("mail endpoint'leri MAIL_NOT_CONFIGURED kodu içerir", () => {
    const resetSource = readFile("app", "api", "admin", "users", "[id]", "reset-password", "route.ts");
    const inviteSource = readFile(
      "app", "api", "admin", "users", "[id]", "memberships", "[companyUserId]", "resend-invite", "route.ts"
    );
    assert.ok(resetSource.includes("503") || resetSource.includes("MAIL_NOT_CONFIGURED"), "503 veya MAIL_NOT_CONFIGURED içermeli");
    assert.ok(inviteSource.includes("503") || inviteSource.includes("MAIL_NOT_CONFIGURED"), "503 veya MAIL_NOT_CONFIGURED içermeli");
  });
});
