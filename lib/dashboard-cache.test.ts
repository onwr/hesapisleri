import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildDashboardCacheKeyParts,
  getDashboardScopedCacheTag,
  resolveDashboardPeriodKey,
  resolveDashboardReferenceDate,
} from "./dashboard-period-utils";
import { getDashboardCacheTag } from "./dashboard-cache-tags";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("dashboard cache keys", () => {
  it("period key YYYY-MM-DD formatında normalize edilir", () => {
    const key = resolveDashboardPeriodKey(new Date(2026, 5, 8, 15, 30, 0));
    assert.equal(key, "2026-06-08");
  });

  it("reference date period key ile tutarlı", () => {
    const key = "2026-06-08";
    const date = resolveDashboardReferenceDate(key);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 5);
    assert.equal(date.getDate(), 8);
  });

  it("farklı company farklı cache tag üretir", () => {
    const tagA = getDashboardCacheTag("company-a");
    const tagB = getDashboardCacheTag("company-b");
    assert.notEqual(tagA, tagB);
    assert.match(tagA, /^dashboard:company-a$/);
  });

  it("cache key parts company ve period içerir", () => {
    const parts = buildDashboardCacheKeyParts({
      companyId: "company-1",
      periodKey: "2026-06-08",
    });
    assert.deepEqual(parts, [
      "dashboard-page-data",
      "company-1",
      "2026-06-08",
      "v2",
    ]);
  });

  it("scoped tag filtre/period içerir", () => {
    assert.equal(
      getDashboardScopedCacheTag({
        companyId: "company-1",
        periodKey: "2026-06-08",
      }),
      "dashboard:company-1:2026-06-08:default"
    );
  });
});

describe("dashboard page architecture", () => {
  it("dashboard page cached data fonksiyonunu kullanır", () => {
    const page = read("app/dashboard/page.tsx");
    assert.match(page, /getCachedDashboardPageData/);
    assert.match(page, /resolveDashboardPeriodKey/);
    assert.doesNotMatch(page, /getDashboardPageDataUncached/);
  });

  it("activity log cache dışında kalır", () => {
    const page = read("app/dashboard/page.tsx");
    assert.match(page, /activityLog\.findMany/);
    assert.match(page, /mapActivityLogToDashboardItem/);
  });

  it("dashboard cache unstable_cache kullanır", () => {
    const cache = read("lib/dashboard-cache.ts");
    assert.match(cache, /unstable_cache/);
    assert.match(cache, /revalidate:\s*DASHBOARD_CACHE_SECONDS/);
  });

  it("dashboard page data serializable number döner", () => {
    const source = read("lib/dashboard-page-data.ts");
    assert.match(source, /todaySales: number/);
    assert.match(source, /balanceFormatted: string/);
    assert.doesNotMatch(source, /Decimal/);
  });

  it("invalidation helper revalidateTag kullanır", () => {
    const source = read("lib/dashboard-cache-invalidation.ts");
    assert.match(source, /revalidateTag/);
    assert.match(source, /server-only/);
  });
});
