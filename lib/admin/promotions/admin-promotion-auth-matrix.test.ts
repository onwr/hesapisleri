import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ADMIN_PROMOTION_ROUTES = [
  "app/api/admin/campaigns/route.ts",
  "app/api/admin/campaigns/[id]/route.ts",
  "app/api/admin/campaigns/[id]/activate/route.ts",
  "app/api/admin/campaigns/[id]/archive/route.ts",
  "app/api/admin/campaigns/[id]/pause/route.ts",
  "app/api/admin/campaigns/[id]/publish/route.ts",
  "app/api/admin/campaigns/[id]/preview/route.ts",
  "app/api/admin/campaigns/[id]/targeting/route.ts",
  "app/api/admin/campaigns/[id]/usage/route.ts",
  "app/api/admin/campaigns/[id]/history/route.ts",
  "app/api/admin/campaigns/[id]/activity/route.ts",
  "app/api/admin/coupons/route.ts",
  "app/api/admin/coupons/[id]/route.ts",
  "app/api/admin/coupons/[id]/activate/route.ts",
  "app/api/admin/coupons/[id]/archive/route.ts",
  "app/api/admin/coupons/[id]/pause/route.ts",
  "app/api/admin/coupons/[id]/preview/route.ts",
  "app/api/admin/coupons/[id]/targeting/route.ts",
  "app/api/admin/coupons/[id]/usage/route.ts",
  "app/api/admin/coupons/[id]/history/route.ts",
  "app/api/admin/coupons/[id]/activity/route.ts",
  "app/api/admin/membership-coupons/preview/route.ts",
  "app/api/admin/membership-coupons/bulk/route.ts",
];

const LEGACY_PROMOTION_REEXPORTS: Array<{ route: string; canonical: RegExp }> = [
  { route: "app/api/admin/membership-coupons/route.ts", canonical: /coupons\/route/ },
  { route: "app/api/admin/membership-coupons/[id]/route.ts", canonical: /coupons\/\[id\]\/route/ },
  {
    route: "app/api/admin/membership-coupons/[id]/pause/route.ts",
    canonical: /coupons\/\[id\]\/pause\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/activate/route.ts",
    canonical: /coupons\/\[id\]\/activate\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/archive/route.ts",
    canonical: /coupons\/\[id\]\/archive\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/redemptions/route.ts",
    canonical: /usage\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/targeting/route.ts",
    canonical: /targeting\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/history/route.ts",
    canonical: /history\/route/,
  },
  {
    route: "app/api/admin/membership-coupons/[id]/activity/route.ts",
    canonical: /activity\/route/,
  },
];

const CRON_ROUTES = [
  "app/api/cron/membership-campaign-lifecycle/route.ts",
  "app/api/cron/discount-reservations/route.ts",
];

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function routePath(relative: string) {
  return path.join(webRoot, relative);
}

describe("admin promotion auth matrix (static)", () => {
  for (const route of ADMIN_PROMOTION_ROUTES) {
    it(`${route} requires super admin`, async () => {
      const source = await readFile(routePath(route), "utf8");
      assert.match(source, /requireSuperAdminApi/);
    });
  }

  for (const route of CRON_ROUTES) {
    it(`${route} requires CRON_SECRET`, async () => {
      const source = await readFile(routePath(route), "utf8");
      assert.match(source, /CRON_SECRET/);
    });
  }
});

describe("legacy promotion re-exports", () => {
  for (const { route, canonical } of LEGACY_PROMOTION_REEXPORTS) {
    it(`${route} re-exports canonical handler`, async () => {
      const source = await readFile(routePath(route), "utf8");
      assert.match(source, canonical);
    });
  }
});

describe("legacy campaign route wrappers", () => {
  it("membership-campaigns list re-exports canonical", async () => {
    const source = await readFile(
      routePath("app/api/admin/membership-campaigns/route.ts"),
      "utf8"
    );
    assert.match(source, /campaigns\/route/);
  });

  it("membership pause/publish re-export canonical", async () => {
    const pause = await readFile(
      routePath("app/api/admin/membership-campaigns/[id]/pause/route.ts"),
      "utf8"
    );
    const publish = await readFile(
      routePath("app/api/admin/membership-campaigns/[id]/publish/route.ts"),
      "utf8"
    );
    assert.match(pause, /campaigns\/\[id\]\/pause\/route/);
    assert.match(publish, /campaigns\/\[id\]\/publish\/route/);
  });
});

describe("coupon validate security", () => {
  it("validate route has rate limit", async () => {
    const source = await readFile(
      routePath("app/api/billing/coupons/validate/route.ts"),
      "utf8"
    );
    assert.match(source, /checkRateLimit/);
    assert.match(source, /429/);
  });

  it("validate uses session company not body companyId", async () => {
    const source = await readFile(
      routePath("app/api/billing/coupons/validate/route.ts"),
      "utf8"
    );
    assert.match(source, /session\.company\.id/);
    assert.doesNotMatch(source, /body\.companyId/);
  });
});
