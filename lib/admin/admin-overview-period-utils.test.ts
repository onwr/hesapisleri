import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdminOverviewCacheKey,
  buildAdminOverviewSearchParams,
  resolveAdminOverviewPeriod,
} from "@/lib/admin/admin-overview-period-utils";

const FIXED_NOW = new Date("2026-06-21T12:00:00.000Z");

describe("resolveAdminOverviewPeriod", () => {
  it("defaults to last 30 days", () => {
    const period = resolveAdminOverviewPeriod({}, FIXED_NOW);
    assert.equal(period.key, "30d");
    assert.equal(period.label, "Son 30 gün");
    assert.ok(period.from < period.to);
    assert.ok(period.comparisonFrom < period.comparisonTo);
    assert.ok(period.comparisonTo < period.from);
  });

  it("parses preset ranges", () => {
    const period = resolveAdminOverviewPeriod({ range: "7d" }, FIXED_NOW);
    assert.equal(period.key, "7d");
    assert.equal(period.label, "Son 7 gün");
  });

  it("parses custom from/to", () => {
    const period = resolveAdminOverviewPeriod(
      { range: "custom", from: "2026-06-01", to: "2026-06-30" },
      FIXED_NOW
    );
    assert.equal(period.key, "custom");
    assert.equal(period.label, "Özel aralık");
    assert.ok(period.from <= period.to);
  });

  it("builds comparison period with equal duration", () => {
    const period = resolveAdminOverviewPeriod(
      { from: "2026-06-10", to: "2026-06-20" },
      FIXED_NOW
    );
    const currentDuration = period.to.getTime() - period.from.getTime();
    const comparisonDuration =
      period.comparisonTo.getTime() - period.comparisonFrom.getTime();
    assert.equal(currentDuration, comparisonDuration);
  });
});

describe("buildAdminOverviewSearchParams", () => {
  it("serializes preset range", () => {
    const period = resolveAdminOverviewPeriod({ range: "30d" }, FIXED_NOW);
    assert.equal(buildAdminOverviewSearchParams(period), "range=30d");
  });

  it("serializes custom range", () => {
    const period = resolveAdminOverviewPeriod(
      { range: "custom", from: "2026-06-01", to: "2026-06-30" },
      FIXED_NOW
    );
    const params = buildAdminOverviewSearchParams(period);
    assert.match(params, /^range=custom&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);
  });
});

describe("buildAdminOverviewCacheKey", () => {
  it("includes range boundaries and timezone", () => {
    const keyA = buildAdminOverviewCacheKey({ range: "30d" });
    const keyB = buildAdminOverviewCacheKey({
      range: "custom",
      from: "2026-06-01",
      to: "2026-06-30",
    });
    assert.notEqual(keyA, keyB);
    assert.match(keyA, /30d:/);
    assert.match(keyA, /Europe\/Istanbul$/);
  });
});
