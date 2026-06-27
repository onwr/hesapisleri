import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isAdminSearchQueryValid } from "@/lib/admin/admin-overview-search-service";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readRoute(segments: string[]) {
  return readFileSync(
    join(webRoot, "app", "api", ...segments, "route.ts"),
    "utf8"
  );
}

describe("admin overview API auth", () => {
  it("GET /api/admin/overview uses requireSuperAdminApi", () => {
    const source = readRoute(["admin", "overview"]);
    assert.match(source, /requireSuperAdminApi/);
  });

  it("GET /api/admin/search uses requireSuperAdminApi", () => {
    const source = readRoute(["admin", "search"]);
    assert.match(source, /requireSuperAdminApi/);
  });
});

describe("admin layout super admin gate", () => {
  it("admin layout uses getSuperAdminSession", () => {
    const source = readFileSync(join(webRoot, "app", "admin", "layout.tsx"), "utf8");
    assert.match(source, /getSuperAdminSession/);
  });
});

describe("admin global search query validation", () => {
  it("requires at least 2 characters", () => {
    assert.equal(isAdminSearchQueryValid(""), false);
    assert.equal(isAdminSearchQueryValid("a"), false);
    assert.equal(isAdminSearchQueryValid("ab"), true);
  });
});
