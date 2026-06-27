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

describe("system health API auth matrix", () => {
  it("GET /api/admin/system-health", () => {
    const src = readRoute(["admin", "system-health"]);
    assert.match(src, /requireSuperAdminApi/);
    assert.match(src, /"error" in auth/);
  });

  it("GET /api/admin/system-health/checks", () => {
    const src = readRoute(["admin", "system-health", "checks"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("POST run check", () => {
    const src = readRoute(["admin", "system-health", "checks", "[checkId]", "run"]);
    assert.match(src, /requireSuperAdminApi/);
    assert.match(src, /assertValidHealthCheckId/);
    assert.match(src, /assertNoArbitraryHealthRunInput/);
  });

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
});
