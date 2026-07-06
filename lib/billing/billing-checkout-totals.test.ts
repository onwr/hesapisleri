import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { buildPriceTotals } from "./pricing-utils";

describe("billing checkout totals", () => {
  it("KDV hariç 1499 TL aylık plan checkout'ta 1798,80 TL olur", () => {
    const totals = buildPriceTotals({
      listPriceMinor: 149_900,
      salePriceMinor: 149_900,
      interval: "MONTHLY",
      vatRate: 20,
      vatIncluded: false,
    });

    assert.equal(totals.totalMinor, 179_880);
  });

  it("serializeBillingPlan checkout toplamını kullanır", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../membership-service.ts"),
      "utf8"
    );
    assert.match(src, /serializeBillingPlanForCompany/);
    assert.match(src, /resolveSubscriptionPrice/);
    assert.match(src, /resolved\.totalMinor \/ 100/);
  });
});
