import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readFile(...segments: string[]) {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

describe("JWT sv (sessionVersion) güvenliği", () => {
  it("sv içeren token verify edilir", () => {
    const token = signSessionToken({ userId: "u1", sv: 3 });
    const payload = verifySessionToken(token);
    assert.equal(payload?.sv, 3);
  });

  it("sv içermeyen token verify edilir ama payload'da sv yok", () => {
    const token = signSessionToken({ userId: "u1" });
    const payload = verifySessionToken(token);
    assert.equal(payload?.sv, undefined);
  });

  it("geçersiz imzalı token null döner", () => {
    const result = verifySessionToken("tamamen.yanlis.token");
    assert.equal(result, null);
  });

  it("auth-dal sessionVersion kontrolü: sv yoksa session-revoked", () => {
    const source = readFile("lib", "auth", "auth-dal.ts");
    assert.ok(
      source.includes("payload.sv === undefined"),
      "sv undefined kontrolü olmalı"
    );
    assert.ok(
      source.includes("session-revoked"),
      "session-revoked dönmeli"
    );
  });

  it("auth-dal sessionVersion kontrolü: sv !== user.sessionVersion reddedilir", () => {
    const source = readFile("lib", "auth", "auth-dal.ts");
    assert.ok(
      source.includes("payload.sv !== user.sessionVersion"),
      "sessionVersion karşılaştırması yapılmalı"
    );
  });

  it("auth-dal DB kontrolü yapıyor (proxy.ts değil)", () => {
    const authDal = readFile("lib", "auth", "auth-dal.ts");
    const proxy = readFile("proxy.ts");
    assert.ok(authDal.includes("sessionVersion"), "auth-dal sessionVersion sorgular");
    assert.ok(!proxy.includes("db.user"), "proxy.ts db.user çağırmaz");
    assert.ok(!proxy.includes("findUnique"), "proxy.ts DB sorgusu çalıştırmaz");
  });

  it("proxy.ts yalnızca imza kontrolü yapar", () => {
    const source = readFile("proxy.ts");
    assert.ok(
      source.includes("verifySessionToken") || source.includes("verify"),
      "imza doğrulaması yapmalı"
    );
    assert.ok(!source.includes("db.user.findUnique"), "DB sorgusu yapmamalı");
    assert.ok(!source.includes("prisma"), "Prisma kullanmamalı");
  });

  it("revoke-sessions servisi sessionVersion artırır", () => {
    const source = readFile("lib", "admin", "users", "admin-user-action-service.ts");
    assert.ok(
      source.includes("sessionVersion: { increment: 1 }"),
      "sessionVersion increment 1 olmalı"
    );
  });

  it("login route'u sv taşıyan token üretir", () => {
    const source = readFile("app", "api", "auth", "login", "route.ts");
    assert.ok(source.includes("sv:"), "login token'ı sv taşımalı");
    assert.ok(
      source.includes("sessionVersion"),
      "login sessionVersion'ı okumalı"
    );
  });

  it("register route'u sv taşıyan token üretir", () => {
    const source = readFile("app", "api", "auth", "register", "route.ts");
    assert.ok(source.includes("sv:"), "register token'ı sv taşımalı");
  });

  it("switch-company route'u sv taşıyan token üretir", () => {
    const source = readFile("app", "api", "auth", "switch-company", "route.ts");
    assert.ok(source.includes("sv:"), "switch-company token'ı sv taşımalı");
  });

  it("invite accept route'u sv taşıyan token üretir", () => {
    const source = readFile("app", "api", "invites", "accept", "route.ts");
    assert.ok(source.includes("sv:"), "invite accept token'ı sv taşımalı");
  });

  it("auth/companies route'u sv taşıyan token üretir", () => {
    const source = readFile("app", "api", "auth", "companies", "route.ts");
    assert.ok(source.includes("sv:"), "companies route token'ı sv taşımalı");
  });

  it("revoke-sessions route'u sessionVersion artırma servisini çağırır", () => {
    const source = readFile(
      "app", "api", "admin", "users", "[id]", "revoke-sessions", "route.ts"
    );
    assert.ok(
      source.includes("adminRevokeUserSessions"),
      "revoke servisini çağırmalı"
    );
  });
});
