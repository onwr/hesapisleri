import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPercentageChangeBadge,
  percentChange,
  resolvePercentageChange,
} from "./percentage-change";

describe("percentage-change", () => {
  it("0 → 100 returns new (not +100%)", () => {
    assert.deepEqual(resolvePercentageChange(100, 0), { kind: "new" });
    assert.equal(percentChange(100, 0), null);
    assert.equal(formatPercentageChangeBadge(resolvePercentageChange(100, 0)).label, "Yeni");
  });

  it("0 → 0 returns unchanged", () => {
    assert.deepEqual(resolvePercentageChange(0, 0), { kind: "unchanged" });
    assert.equal(percentChange(0, 0), 0);
  });

  it("100 → 150 returns +50%", () => {
    assert.deepEqual(resolvePercentageChange(150, 100), { kind: "percent", value: 50 });
    assert.equal(percentChange(150, 100), 50);
  });

  it("100 → 50 returns -50%", () => {
    assert.equal(percentChange(50, 100), -50);
  });

  it("invert flag flips positive for expenses", () => {
    const badge = formatPercentageChangeBadge(resolvePercentageChange(150, 100), {
      invert: true,
    });
    assert.equal(badge.positive, false);
  });
});
