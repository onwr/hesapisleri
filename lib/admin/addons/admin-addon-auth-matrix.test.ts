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

const CANONICAL_ADDON_ROUTES: string[][] = [
  ["admin", "add-ons"],
  ["admin", "add-ons", "[id]"],
  ["admin", "add-ons", "[id]", "activate"],
  ["admin", "add-ons", "[id]", "archive"],
  ["admin", "add-ons", "[id]", "preview"],
  ["admin", "add-ons", "[id]", "prices"],
  ["admin", "add-ons", "[id]", "prices", "[priceId]", "publish"],
  ["admin", "add-ons", "[id]", "subscriptions"],
  ["admin", "add-ons", "[id]", "history"],
  ["admin", "add-ons", "[id]", "activity"],
];

const LEGACY_ADDON_REEXPORTS: Array<{ segments: string[]; canonical: RegExp }> = [
  { segments: ["admin", "membership-addons"], canonical: /add-ons\/route/ },
  { segments: ["admin", "membership-addons", "[id]"], canonical: /add-ons\/\[id\]\/route/ },
  {
    segments: ["admin", "membership-addons", "[id]", "archive"],
    canonical: /archive\/route/,
  },
  {
    segments: ["admin", "membership-addons", "[id]", "prices"],
    canonical: /prices\/route/,
  },
  {
    segments: ["admin", "membership-addons", "[id]", "prices", "[priceId]", "publish"],
    canonical: /publish\/route/,
  },
  {
    segments: ["admin", "membership-addons", "[id]", "companies"],
    canonical: /subscriptions\/route/,
  },
];

const OTHER_ADMIN_ROUTES: string[][] = [
  ["admin", "membership-plans", "[id]", "entitlements"],
  ["admin", "membership-plans", "[id]", "entitlements", "publish"],
  ["admin", "companies", "[id]", "entitlement-overrides"],
  ["admin", "companies", "[id]", "entitlement-overrides", "[overrideId]"],
  ["admin", "companies", "[id]", "usage-adjustments"],
];

describe("canonical addon API auth", () => {
  for (const segments of CANONICAL_ADDON_ROUTES) {
    it(`${segments.join("/")} uses requireSuperAdminApi`, () => {
      assert.match(readRoute(segments), /requireSuperAdminApi/);
    });
  }
});

describe("legacy addon re-exports", () => {
  for (const { segments, canonical } of LEGACY_ADDON_REEXPORTS) {
    it(`${segments.join("/")} re-exports canonical`, () => {
      assert.match(readRoute(segments), canonical);
    });
  }
});

describe("other admin entitlement routes", () => {
  for (const segments of OTHER_ADMIN_ROUTES) {
    it(`${segments.join("/")} uses requireSuperAdminApi`, () => {
      assert.match(readRoute(segments), /requireSuperAdminApi/);
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
