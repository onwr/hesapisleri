import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalPlanDisplay,
  isInternalTestMembershipPlan,
  sanitizeMembershipPlanDisplayName,
} from "@/lib/billing/canonical-plan-display";
import { buildPriceTotals } from "@/lib/billing/pricing-utils";

describe("canonical plan display helpers", () => {
  it("internal test plan adlarını filtreler", () => {
    assert.equal(
      isInternalTestMembershipPlan({ name: "ANA PAKET TEST", code: "STANDARD" }),
      true
    );
    assert.equal(
      isInternalTestMembershipPlan({ name: "Standart Paket", code: "TEST" }),
      true
    );
    assert.equal(
      isInternalTestMembershipPlan({ name: "Standart Paket", code: "STANDARD" }),
      false
    );
  });

  it("test içeren display name sanitize edilir", () => {
    assert.equal(
      sanitizeMembershipPlanDisplayName("ANA PAKET TEST"),
      "ANA PAKET"
    );
  });

  it("yıllık indirim yalnız gerçek fiyat farkı varsa gösterilir", async () => {
    const display = await buildCanonicalPlanDisplay({
      plan: {
        id: "plan-1",
        code: "STANDARD",
        name: "Standart Paket",
        currency: "TRY",
        planStatus: "ACTIVE",
        trialEnabled: true,
        trialDays: 30,
      },
      platformTrialDays: 14,
    });

    assert.equal(display, null);
  });
});

describe("canonical plan display — yıllık matematik", () => {
  it("12 aylık toplam ile yıllık fiyat karşılaştırması doğru", () => {
    const monthly = buildPriceTotals({
      listPriceMinor: 149_900,
      salePriceMinor: 149_900,
      interval: "MONTHLY",
      vatRate: 20,
      vatIncluded: false,
    });
    const yearly = buildPriceTotals({
      listPriceMinor: monthly.salePriceMinor * 12,
      salePriceMinor: monthly.salePriceMinor * 12,
      interval: "YEARLY",
      vatRate: 20,
      vatIncluded: false,
    });

    assert.equal(monthly.salePriceMinor * 12, yearly.salePriceMinor);
    assert.equal(yearly.monthlyEquivalentMinor, monthly.salePriceMinor);
  });
});
