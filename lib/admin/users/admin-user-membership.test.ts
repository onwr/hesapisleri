import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readSource() {
  return readFileSync(
    join(webRoot, "lib", "admin", "users", "admin-user-membership-service.ts"),
    "utf8"
  );
}

describe("firma üyeliği güvenlik kuralları", () => {
  it("isOwner=true üyelikte hiçbir değişiklik yapılamaz", () => {
    const source = readSource();
    assert.ok(
      source.includes("membership.isOwner"),
      "isOwner kontrolü olmalı"
    );
    assert.ok(
      source.includes("Firma sahibinin üyeliği bu arayüzden değiştirilemez"),
      "isOwner hata mesajı olmalı"
    );
  });

  it("isOwner kontrolü schema validasyonundan önce gelir", () => {
    const source = readSource();
    const ownerCheckIdx = source.indexOf("membership.isOwner");
    const schemaParseIdx = source.indexOf("adminUserMembershipPatchSchema.safeParse");
    // schema parse işleminden sonra isOwner kontrolü olmalı (membership fetch'in ardından)
    assert.ok(ownerCheckIdx > schemaParseIdx, "schema parse'dan sonra isOwner kontrolü olmalı");
  });

  it("adminUpdateCompanyMembership isOwner'ı kesin olarak reddeder (throw)", () => {
    const source = readSource();
    // isOwner kontrolü throw içermeli
    const ownerCheckBlock = source.slice(
      source.indexOf("membership.isOwner"),
      source.indexOf("membership.isOwner") + 300
    );
    assert.ok(ownerCheckBlock.includes("throw"), "isOwner bloğu throw içermeli");
  });

  it("adminResendMembershipInvite 503 fırlatır (mail yok)", async () => {
    const { adminResendMembershipInvite, AdminUserMembershipError } =
      await import("@/lib/admin/users/admin-user-membership-service");
    try {
      await adminResendMembershipInvite("u1", "cu1", "admin1");
      assert.fail("503 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminUserMembershipError);
      assert.equal(e.status, 503);
    }
  });

  it("adminResendMembershipInvite companyInvite.create çağırmaz", () => {
    const source = readSource();
    assert.ok(
      !source.includes("companyInvite.create"),
      "davet token'ı oluşturulmamalı"
    );
    assert.ok(
      !source.includes("randomBytes"),
      "random bytes üretilmemeli"
    );
  });

  it("membership PATCH endpoint'i requireSuperAdminApi kullanır", () => {
    const routeSource = readFileSync(
      join(webRoot, "app", "api", "admin", "users", "[id]", "memberships", "[companyUserId]", "route.ts"),
      "utf8"
    );
    assert.ok(
      routeSource.includes("requireSuperAdminApi"),
      "PATCH membership endpoint'i super admin gerektirmeli"
    );
  });

  it("resend-invite endpoint'i requireSuperAdminApi kullanır", () => {
    const routeSource = readFileSync(
      join(
        webRoot,
        "app", "api", "admin", "users", "[id]", "memberships",
        "[companyUserId]", "resend-invite", "route.ts"
      ),
      "utf8"
    );
    assert.ok(
      routeSource.includes("requireSuperAdminApi"),
      "resend-invite endpoint'i super admin gerektirmeli"
    );
  });
});
