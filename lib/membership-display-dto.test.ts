import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalMembershipDisplay,
  formatMembershipDisplayDate,
} from "./membership-display-dto";

describe("membership-display-dto", () => {
  it("trial için deneme bitiş tarihini kullanır", () => {
    const display = buildCanonicalMembershipDisplay({
      subscription: {
        status: "TRIAL",
        trialEndsAt: new Date("2026-08-01T20:59:59.000Z"),
        currentPeriodEnd: new Date("2026-09-01T20:59:59.000Z"),
      },
      sourceCompanyId: "co-1",
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    });

    assert.equal(display.primaryDateLabel, "Deneme bitişi");
    assert.equal(display.subscriptionStatus, "TRIAL");
    assert.ok(display.primaryDateDisplay);
  });

  it("autoRenew aktifken sonraki yenileme tarihini gösterir", () => {
    const display = buildCanonicalMembershipDisplay({
      subscription: {
        status: "ACTIVE",
        autoRenew: true,
        nextBillingAt: new Date("2026-08-15T21:00:00.000Z"),
        currentPeriodEnd: new Date("2026-08-15T21:00:00.000Z"),
      },
      sourceCompanyId: "co-1",
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    });

    assert.equal(display.primaryDateLabel, "Sonraki yenileme");
    assert.ok(display.primaryDateDisplay);
  });

  it("Europe/Istanbul formatı aynı instant için tutarlıdır", () => {
    const iso = "2026-07-31T21:00:00.000Z";
    const formatted = formatMembershipDisplayDate(iso);
    assert.equal(formatted, formatMembershipDisplayDate(new Date(iso)));
  });
});
