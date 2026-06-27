import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function routePath(segments: string[]) {
  return join(webRoot, "app", "api", ...segments, "route.ts");
}

function readRoute(segments: string[]) {
  return readFileSync(routePath(segments), "utf8");
}

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

const CANONICAL_PARTNER_ROUTES: Array<{ segments: string[]; methods: string[] }> = [
  { segments: ["admin", "partners"], methods: ["GET", "POST"] },
  { segments: ["admin", "partners", "[id]"], methods: ["GET", "PATCH"] },
  { segments: ["admin", "partners", "[id]", "activate"], methods: ["POST"] },
  { segments: ["admin", "partners", "[id]", "suspend"], methods: ["POST"] },
  { segments: ["admin", "partners", "[id]", "archive"], methods: ["POST"] },
  { segments: ["admin", "partners", "[id]", "companies"], methods: ["GET"] },
  { segments: ["admin", "partners", "[id]", "commissions"], methods: ["GET"] },
  { segments: ["admin", "partners", "[id]", "history"], methods: ["GET"] },
  { segments: ["admin", "partners", "[id]", "activity"], methods: ["GET"] },
  { segments: ["admin", "partners", "[id]", "notes"], methods: ["GET", "POST"] },
  { segments: ["admin", "partners", "[id]", "notes", "[noteId]"], methods: ["PATCH", "DELETE"] },
];

describe("canonical partner API auth matrix", () => {
  for (const { segments, methods } of CANONICAL_PARTNER_ROUTES) {
    it(`${segments.join("/")} (${methods.join(",")}) uses requireSuperAdminApi`, () => {
      const source = readRoute(segments);
      assert.match(source, /requireSuperAdminApi/);
      assert.match(source, /"error" in auth/);
      for (const method of methods) {
        assert.match(
          source,
          new RegExp(`export async function ${method}`),
          `${segments.join("/")} missing ${method}`
        );
      }
    });
  }
});

describe("partner super admin gate", () => {
  it("SUPER_ADMIN erişir", () => {
    assert.equal(
      isPlatformSuperAdminUser({
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        email: "super@platform.test",
      }),
      true
    );
  });

  it("tenant OWNER reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({
        role: "OWNER",
        status: "ACTIVE",
        email: "owner@company.test",
      }),
      false
    );
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({
        role: "ADMIN",
        status: "ACTIVE",
        email: "admin@company.test",
      }),
      false
    );
  });

  it("session yok reddedilir — requireSuperAdminApi 401 döner", () => {
    const auth = readSrc("lib/admin-auth.ts");
    assert.match(auth, /if \(!token\)/);
    assert.match(auth, /status: 401/);
    assert.match(auth, /Oturum bulunamadı/);
  });

  it("SUPER_ADMIN olmayan aktif kullanıcı 403 alır", () => {
    const auth = readSrc("lib/admin-auth.ts");
    assert.match(auth, /if \(!isPlatformSuperAdminUser\(user\)\)/);
    assert.match(auth, /status: 403/);
    assert.match(auth, /Super Admin yetkisi gerekir/);
  });
});

describe("partner route param policy", () => {
  it("note mutation partnerId route params'tan alınır", () => {
    const patch = readRoute(["admin", "partners", "[id]", "notes", "[noteId]"]);
    assert.match(patch, /await context\.params/);
    assert.match(patch, /updateAdminPartnerNote\(id, noteId/);
    assert.doesNotMatch(patch, /body\.partnerId/);
  });

  it("lifecycle partnerId params'tan alınır", () => {
    const activate = readRoute(["admin", "partners", "[id]", "activate"]);
    assert.match(activate, /activatePartner\(id/);
    assert.doesNotMatch(activate, /body\.partnerId/);
  });
});
