import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionSubscriptionStatus,
} from "@/lib/payments/payment-state-machine";
import {
  countActiveSubscriptionFilters,
  getSubscriptionStatusUiLabel,
  mapResolvedPriceSource,
  parseAdminSubscriptionFilters,
} from "@/lib/admin-subscription-utils";

describe("admin subscription utils", () => {
  it("parses list filters from search params", () => {
    const filters = parseAdminSubscriptionFilters({
      q: "acme",
      status: "ACTIVE",
      page: "2",
    });
    assert.equal(filters.q, "acme");
    assert.equal(filters.status, "ACTIVE");
    assert.equal(filters.page, 2);
  });

  it("counts active advanced filters", () => {
    const count = countActiveSubscriptionFilters({
      planId: "plan-1",
      status: "TRIAL",
      autoRenew: "true",
    });
    assert.equal(count, 3);
  });

  it("maps resolved price source labels", () => {
    const mapped = mapResolvedPriceSource("GRANDFATHERED", []);
    assert.equal(mapped.label, "GRANDFATHERED");
  });

  it("uses Turkish past due label", () => {
    assert.equal(getSubscriptionStatusUiLabel("PAST_DUE"), "Ödeme Gecikti");
  });
});

describe("admin subscription state transitions", () => {
  it("allows cancel at period end from active", () => {
    assert.equal(
      canTransitionSubscriptionStatus("ACTIVE", "CANCEL_AT_PERIOD_END"),
      true
    );
  });

  it("rejects trial extend target from cancelled", () => {
    assert.equal(canTransitionSubscriptionStatus("CANCELLED", "TRIAL"), false);
  });

  it("allows reactivation from cancel at period end", () => {
    assert.equal(canTransitionSubscriptionStatus("CANCEL_AT_PERIOD_END", "ACTIVE"), true);
  });
});
