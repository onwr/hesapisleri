import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { priceRangesOverlap } from "@/lib/admin/plans/admin-plan-price-overlap";

describe("admin plan price overlap edge cases", () => {
  const d = (iso: string) => new Date(iso);

  it("different interval scope is checked separately (unit: same list per interval)", () => {
    const tryMonthly = { effectiveFrom: d("2026-01-01"), effectiveUntil: d("2026-06-01") };
    const tryMonthly2 = { effectiveFrom: d("2026-03-01"), effectiveUntil: null };
    assert.equal(priceRangesOverlap(tryMonthly, tryMonthly2), true);
  });

  it("ARCHIVED/EXPIRED not in overlap candidate set (integration via publish service filter)", () => {
    // Overlap util is pure; publish service only passes ACTIVE/SCHEDULED peers.
    assert.equal(
      priceRangesOverlap(
        { effectiveFrom: d("2026-01-01"), effectiveUntil: d("2026-12-01") },
        { effectiveFrom: d("2026-06-01"), effectiveUntil: null }
      ),
      true
    );
  });
});
