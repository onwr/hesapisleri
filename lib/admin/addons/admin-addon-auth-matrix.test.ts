import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function routePath(segments: string[]) {
  return join(webRoot, "app", "api", ...segments, "route.ts");
}

function readRoute(segments: string[]) {
  return readFileSync(routePath(segments), "utf8");
}

const ADMIN_ADDON_ROUTES: string[][] = [
  ["admin", "membership-addons"],
  ["admin", "membership-addons", "[id]"],
  ["admin", "membership-addons", "[id]", "archive"],
  ["admin", "membership-addons", "[id]", "companies"],
  ["admin", "membership-addons", "[id]", "prices"],
  ["admin", "membership-plans", "[id]", "entitlements"],
  ["admin", "membership-plans", "[id]", "entitlements", "publish"],
  ["admin", "companies", "[id]", "entitlement-overrides"],
  ["admin", "companies", "[id]", "entitlement-overrides", "[overrideId]"],
  ["admin", "companies", "[id]", "usage-adjustments"],
];

describe("admin addon/entitlement auth matrix", () => {
  for (const segments of ADMIN_ADDON_ROUTES) {
    it(`${segments.join("/")} uses requireSuperAdminApi`, () => {
      const source = readRoute(segments);
      assert.match(source, /requireSuperAdminApi/);
    });
  }
});

describe("billing addon routes auth", () => {
  it("GET /api/billing/addons uses session + canManageMembership", () => {
    const source = readRoute(["billing", "addons"]);
    assert.match(source, /getAppSession/);
    assert.match(source, /canManageMembership/);
  });

  it("POST /api/billing/addons/initialize uses session auth", () => {
    const source = readRoute(["billing", "addons", "initialize"]);
    assert.match(source, /getAppSession/);
    assert.match(source, /canManageMembership/);
  });
});

describe("rate limit distributed store", () => {
  it("documents in-memory limitation and provides store interface", async () => {
    const rateLimitSource = readFileSync(
      join(webRoot, "lib", "rate-limit.ts"),
      "utf8"
    );
    assert.match(rateLimitSource, /Serverless multi-instance/i);
    assert.match(rateLimitSource, /checkRateLimitAsync/);

    const storeSource = readFileSync(join(webRoot, "lib", "rate-limit-store.ts"), "utf8");
    assert.match(storeSource, /RateLimitStore/);
    assert.match(storeSource, /registerDistributedRateLimitStore/);
  });
});
