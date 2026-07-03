import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeBillingPeriodInput,
  resolveCanonicalBillingPeriod,
} from "@/lib/billing/canonical-billing-period";

describe("canonical billing period", () => {
  it("normalizes legacy MONTH to MONTHLY", () => {
    assert.equal(normalizeBillingPeriodInput("MONTH"), "MONTHLY");
    assert.equal(normalizeBillingPeriodInput("1"), "MONTHLY");
  });

  it("normalizes SEMIANNUAL to SEMI_ANNUAL", () => {
    assert.equal(normalizeBillingPeriodInput("SEMIANNUAL"), "SEMI_ANNUAL");
    assert.equal(normalizeBillingPeriodInput("6"), "SEMI_ANNUAL");
  });

  it("resolves from locked plan price first", () => {
    assert.equal(
      resolveCanonicalBillingPeriod({
        billingInterval: null,
        lockedPlanPriceBillingInterval: "YEARLY",
      }),
      "YEARLY"
    );
  });

  it("resolves intervalMonths 1 to MONTHLY", () => {
    assert.equal(
      resolveCanonicalBillingPeriod({
        billingInterval: null,
        intervalMonths: 1,
      }),
      "MONTHLY"
    );
  });

  it("returns null when nothing resolvable", () => {
    assert.equal(
      resolveCanonicalBillingPeriod({
        billingInterval: null,
      }),
      null
    );
  });
});
