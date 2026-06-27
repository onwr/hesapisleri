import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isPlatformSuperAdminUser } from "@/lib/admin-auth";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

const CANONICAL_ROUTES: Array<{ segments: string[]; methods: string[] }> = [
  { segments: ["admin", "system-logs"], methods: ["GET"] },
  { segments: ["admin", "system-logs", "[id]"], methods: ["GET"] },
  { segments: ["admin", "system-logs", "export"], methods: ["GET"] },
];

describe("system logs API auth matrix", () => {
  for (const { segments, methods } of CANONICAL_ROUTES) {
    it(`${segments.join("/")} (${methods.join(",")}) requireSuperAdminApi`, () => {
      const source = readRoute(segments);
      assert.match(source, /requireSuperAdminApi/);
      assert.match(source, /"error" in auth/);
      for (const method of methods) {
        assert.match(source, new RegExp(`export async function ${method}`));
      }
    });
  }

  it("SUPER_ADMIN erişir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "SUPER_ADMIN", status: "ACTIVE", email: "s@p.com" }),
      true
    );
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });

  it("POST/PATCH/DELETE 405", () => {
    const list = readRoute(["admin", "system-logs"]);
    assert.match(list, /405/);
    const detail = readRoute(["admin", "system-logs", "[id]"]);
    assert.match(detail, /405/);
  });
});
