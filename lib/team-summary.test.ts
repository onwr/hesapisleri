import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCanonicalTeamSummary } from "./team-summary";

describe("team-summary", () => {
  it("çalışan yokken tüm metrikler sıfır ve empty-state açılır", () => {
    const summary = buildCanonicalTeamSummary({ employees: [] });
    assert.equal(summary.totalEmployees, 0);
    assert.equal(summary.pendingLeaves, 0);
    assert.equal(summary.pendingPayments, 0);
    assert.equal(summary.showEmptyTeamState, true);
  });

  it("arşivli çalışanın bekleyen kayıtları aktif metriğe girmez", () => {
    const summary = buildCanonicalTeamSummary({
      employees: [
        {
          status: "TERMINATED",
          pendingPaymentCount: 3,
          pendingLeaveCount: 2,
        },
        {
          status: "ACTIVE",
          pendingPaymentCount: 1,
          pendingLeaveCount: 1,
        },
      ],
    });

    assert.equal(summary.pendingPayments, 1);
    assert.equal(summary.pendingLeaves, 1);
  });
});
