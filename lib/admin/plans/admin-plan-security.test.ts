/**
 * Faz 6 plan route güvenliği
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(...segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", "admin", "plans", ...segments), "utf8");
}

describe("admin plans route security", () => {
  it("canonical list route is super-admin only", () => {
    assert.ok(readRoute("route.ts").includes("requireSuperAdminApi"));
  });

  it("legacy membership-plans delegates to canonical services", () => {
    const legacy = readFileSync(
      join(webRoot, "app/api/admin/membership-plans/route.ts"),
      "utf8"
    );
    assert.ok(legacy.includes("getAdminPlanList"));
    assert.ok(legacy.includes("Deprecation"));
  });

  it("membership-service PATCH schema excludes lifecycle and prices", () => {
    const src = readFileSync(join(webRoot, "lib/membership-service.ts"), "utf8");
    assert.ok(!src.includes("monthlyPrice: z.number"));
    assert.ok(!src.includes("isActive: z.boolean"));
    assert.ok(src.includes("patchAdminPlanMetadata"));
  });
});
