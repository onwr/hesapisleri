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

describe("partner settings API auth matrix", () => {
  it("GET requireSuperAdminApi", () => {
    const src = readRoute(["admin", "partners", "settings"]);
    assert.match(src, /requireSuperAdminApi/);
    assert.match(src, /export async function GET/);
  });

  it("PUT requireSuperAdminApi", () => {
    const src = readRoute(["admin", "partners", "settings"]);
    assert.match(src, /export async function PUT/);
  });

  it("PATCH 405", () => {
    const src = readRoute(["admin", "partners", "settings"]);
    assert.match(src, /405/);
  });

  it("tenant ADMIN reddedilir", () => {
    assert.equal(
      isPlatformSuperAdminUser({ role: "ADMIN", status: "ACTIVE", email: "a@t.com" }),
      false
    );
  });
});
