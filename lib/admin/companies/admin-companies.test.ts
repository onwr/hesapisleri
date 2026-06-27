import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildAdminCompanyListWhere,
  parseAdminCompanyFilters,
} from "@/lib/admin/companies/admin-company-filter-utils";
import { detectCompanyIssues } from "@/lib/admin/companies/admin-company-issue-service";
import { buildAdminCompanyListCacheKey } from "@/lib/admin/companies/admin-company-filter-utils";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

describe("parseAdminCompanyFilters", () => {
  it("parses pagination and sort", () => {
    const filters = parseAdminCompanyFilters({
      page: "2",
      pageSize: "50",
      sort: "name",
      q: "acme",
    });
    assert.equal(filters.page, 2);
    assert.equal(filters.pageSize, 50);
    assert.equal(filters.sort, "name");
    assert.equal(filters.q, "acme");
  });
});

describe("buildAdminCompanyListWhere", () => {
  it("maps archived filter", () => {
    const where = buildAdminCompanyListWhere({ status: "ARCHIVED" });
    assert.ok(where.archivedAt);
  });

  it("maps trial ending issue filter", () => {
    const where = buildAdminCompanyListWhere({ issue: "trial_ending" });
    assert.ok(where.subscription);
  });
});

describe("detectCompanyIssues", () => {
  it("flags missing owner", () => {
    const issues = detectCompanyIssues({
      company: { id: "c1", status: "ACTIVE", archivedAt: null },
      subscription: null,
      owner: null,
      activeUserCount: 0,
      lastPayment: null,
      lastLoginAt: null,
      lastActivityAt: null,
      integrationErrors: 0,
    });
    assert.ok(issues.some((issue) => issue.code === "no_owner"));
  });

  it("flags trial ending within 7 days", () => {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 3);
    const issues = detectCompanyIssues({
      company: { id: "c1", status: "ACTIVE", archivedAt: null },
      subscription: {
        id: "s1",
        status: "TRIAL",
        trialEndsAt,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
        failedPaymentCount: 0,
      },
      owner: { status: "ACTIVE" },
      activeUserCount: 1,
      lastPayment: null,
      lastLoginAt: new Date(),
      lastActivityAt: new Date(),
      integrationErrors: 0,
    });
    assert.ok(issues.some((issue) => issue.code === "trial_ending"));
  });
});

describe("admin companies API auth", () => {
  const routes = [
    ["admin", "companies"],
    ["admin", "companies", "[id]"],
    ["admin", "companies", "[id]", "suspend"],
    ["admin", "companies", "[id]", "reactivate"],
    ["admin", "companies", "[id]", "extend-trial"],
    ["admin", "companies", "[id]", "notes"],
  ] as const;

  for (const segments of routes) {
    it(`${segments.join("/")} uses requireSuperAdminApi`, () => {
      const source = readRoute([...segments]);
      assert.match(source, /requireSuperAdminApi/);
    });
  }
});

describe("buildAdminCompanyListCacheKey", () => {
  it("changes with filters", () => {
    const a = buildAdminCompanyListCacheKey({ page: 1, sort: "newest" });
    const b = buildAdminCompanyListCacheKey({ page: 2, sort: "name" });
    assert.notEqual(a, b);
  });
});
