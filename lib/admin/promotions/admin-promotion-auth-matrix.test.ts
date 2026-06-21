import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ADMIN_PROMOTION_ROUTES = [
  "app/api/admin/membership-campaigns/route.ts",
  "app/api/admin/membership-campaigns/[id]/route.ts",
  "app/api/admin/membership-campaigns/[id]/publish/route.ts",
  "app/api/admin/membership-campaigns/[id]/pause/route.ts",
  "app/api/admin/membership-campaigns/[id]/activate/route.ts",
  "app/api/admin/membership-campaigns/[id]/archive/route.ts",
  "app/api/admin/membership-campaigns/[id]/preview/route.ts",
  "app/api/admin/membership-coupons/route.ts",
  "app/api/admin/membership-coupons/[id]/route.ts",
  "app/api/admin/membership-coupons/[id]/pause/route.ts",
  "app/api/admin/membership-coupons/[id]/activate/route.ts",
  "app/api/admin/membership-coupons/[id]/archive/route.ts",
  "app/api/admin/membership-coupons/[id]/redemptions/route.ts",
  "app/api/admin/membership-coupons/bulk/route.ts",
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
