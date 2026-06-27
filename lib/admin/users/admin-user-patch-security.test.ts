import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { adminUserPatchSchema } from "@/lib/admin-utils";
import { AdminServiceError } from "@/lib/admin-service";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readFile(...segments: string[]) {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

describe("generic admin PATCH security", () => {
  it("adminUserPatchSchema role'ü reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ role: "SUPER_ADMIN" });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema status'ü reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ status: "SUSPENDED" });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema sessionVersion'ı reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ sessionVersion: 999 });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema suspendedAt'i reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ suspendedAt: new Date().toISOString() });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema suspendedReason'ı reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ suspendedReason: "test" });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema emailVerificationStatus'ü reddeder", () => {
    const result = adminUserPatchSchema.safeParse({ emailVerificationStatus: "VERIFIED" });
    assert.equal(result.success, false);
  });

  it("adminUserPatchSchema boş body'yi kabul eder (405 servisi yakalar)", () => {
    const result = adminUserPatchSchema.safeParse({});
    assert.equal(result.success, true);
  });

  it("updateAdminUser her durumda 405 fırlatır", async () => {
    const { updateAdminUser } = await import("@/lib/admin-service");
    try {
      await updateAdminUser("user-1", "admin-1", {});
      assert.fail("405 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminServiceError);
      assert.equal(e.status, 405);
    }
  });

  it("updateAdminUser role ile çağrılınca da 405 döner", async () => {
    const { updateAdminUser } = await import("@/lib/admin-service");
    try {
      await updateAdminUser("user-1", "admin-1", { role: "SUPER_ADMIN" });
      assert.fail("405 fırlatılmalıydı");
    } catch (e) {
      assert.ok(e instanceof AdminServiceError);
      assert.equal(e.status, 405);
    }
  });

  it("PATCH route dosyası updateAdminUser'ı import etmez", () => {
    const source = readFile("app", "api", "admin", "users", "[id]", "route.ts");
    assert.ok(!source.includes("updateAdminUser"), "updateAdminUser PATCH route'unda kullanılmamalı");
  });

  it("PATCH route dosyası her zaman 405 döner", () => {
    const source = readFile("app", "api", "admin", "users", "[id]", "route.ts");
    assert.ok(source.includes("405"), "PATCH handler 405 dönmeli");
  });
});
