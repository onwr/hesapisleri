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

describe("veri güvenliği — hassas alanlar response'a çıkmamalı", () => {
  it("detail servis password alanını seçmez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-detail-service.ts");
    // password select edilmemeli — false veya hiç belirtilmemiş olmalı
    assert.ok(!source.includes("password: true"), "password select edilmemeli");
  });

  it("detail servis tokenHash seçmez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-detail-service.ts");
    assert.ok(!source.includes("tokenHash: true"), "tokenHash select edilmemeli");
    // Yorum satırları dışında tokenHash kullanılmamalı
    const linesWithTokenHash = source
      .split("\n")
      .filter((l) => l.includes("tokenHash") && !l.trimStart().startsWith("//"));
    assert.equal(linesWithTokenHash.length, 0, "tokenHash kod satırlarında olmamalı");
  });

  it("detail servis resetLink döndürmez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-detail-service.ts");
    assert.ok(!source.includes("resetLink"), "resetLink döndürülmemeli");
  });

  it("detail servis sessionVersion ham değerini response'ta döndürmez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-detail-service.ts");
    // getAdminUserSecurityTab'ın return bloğunu izole et
    const securityTab = source.slice(
      source.indexOf("getAdminUserSecurityTab"),
      source.indexOf("getAdminUserSupportTab")
    );
    // return bloğu içinde sessionVersion key olarak geçmemeli
    // (select'te okumak farklı, response key'i olarak dönmek farklı)
    const returnBlock = securityTab.slice(securityTab.lastIndexOf("return {"));
    assert.ok(!returnBlock.includes("sessionVersion"), "sessionVersion raw değeri response'ta olmamalı");
    // Bunun yerine soyut boolean dönmeli
    assert.ok(securityTab.includes("hasActiveSessions"), "soyut hasActiveSessions dönmeli");
  });

  it("list servis password seçmez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-list-service.ts");
    assert.ok(!source.includes("password: true"), "liste password seçmemeli");
  });

  it("aktif IP tam olarak loglanmaz — maskIp kullanılır", () => {
    const serializerSource = readFile("lib", "admin", "users", "admin-user-serializers.ts");
    assert.ok(serializerSource.includes("maskIp"), "maskIp fonksiyonu olmalı");
    // maskIp son oktet(ler)i gizliyor
    assert.ok(serializerSource.includes(".x.") || serializerSource.includes("x.x"), "IP maskeleme uygulanmalı");
  });

  it("maskIp aktivite servisinde kullanılıyor", () => {
    const source = readFile("lib", "admin", "users", "admin-user-detail-service.ts");
    assert.ok(source.includes("maskIp"), "aktivite sekmesi maskIp kullanmalı");
  });

  it("export CSV şifreli alanları içermez", () => {
    const source = readFile("lib", "admin", "users", "admin-user-list-service.ts");
    const csvSection = source.slice(source.indexOf("exportAdminUsersAsCsv"));
    assert.ok(!csvSection.includes("password"), "CSV'de password olmamalı");
    assert.ok(!csvSection.includes("sessionVersion"), "CSV'de sessionVersion olmamalı");
    assert.ok(!csvSection.includes("tokenHash"), "CSV'de tokenHash olmamalı");
  });

  it("AdminUserNote başka kullanıcıya sızmaz — not servisinde userId filtresi var", () => {
    const source = readFile("lib", "admin", "users", "admin-user-note-service.ts");
    assert.ok(
      source.includes("aboutUserId") || source.includes("userId"),
      "not servisi userId ile filtrelemelii"
    );
  });

  it("tüm admin user endpoint'leri requireSuperAdminApi kullanır", () => {
    const routes = [
      ["app", "api", "admin", "users", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "suspend", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "reactivate", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "revoke-sessions", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "reset-password", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "resend-verification", "route.ts"],
      ["app", "api", "admin", "users", "[id]", "notes", "route.ts"],
    ];
    for (const segments of routes) {
      const source = readFile(...segments);
      assert.ok(
        source.includes("requireSuperAdminApi"),
        `${segments.join("/")} requireSuperAdminApi kullanmalı`
      );
    }
  });

  it("tenant admin /api/admin/users endpoint'ine erişemez (requireSuperAdminApi kontrolü)", () => {
    const authSource = readFile("lib", "admin-auth.ts");
    // requireSuperAdminApi'nin SUPER_ADMIN kontrolü yaptığını doğrula
    assert.ok(
      authSource.includes("SUPER_ADMIN") || authSource.includes("superAdmin"),
      "requireSuperAdminApi SUPER_ADMIN kontrolü yapmalı"
    );
  });
});
