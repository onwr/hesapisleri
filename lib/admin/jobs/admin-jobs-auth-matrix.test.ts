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

describe("admin jobs API auth matrix", () => {
  it("GET /api/admin/jobs", () => {
    const src = readRoute(["admin", "jobs"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("GET job detail", () => {
    const src = readRoute(["admin", "jobs", "[jobKey]"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("GET runs", () => {
    const src = readRoute(["admin", "jobs", "[jobKey]", "runs"]);
    assert.match(src, /requireSuperAdminApi/);
  });

  it("POST run", () => {
    const src = readRoute(["admin", "jobs", "[jobKey]", "run"]);
    assert.match(src, /requireSuperAdminApi/);
    assert.match(src, /assertNoForbiddenJobRunKeys/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });
});
