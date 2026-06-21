import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("billing coupon interval", () => {
  it("billing panel uses selectedBillingInterval state", async () => {
    const source = await readFile(
      new URL("../../components/settings/membership-billing-panel.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /selectedBillingInterval/);
    assert.match(source, /billingInterval: interval/);
    assert.doesNotMatch(source, /billingInterval: "MONTHLY"/);
  });

  it("revalidates coupon when billing interval changes", async () => {
    const source = await readFile(
      new URL("../../components/settings/membership-billing-panel.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /validateCoupon\(couponCode, selectedBillingInterval\)/);
  });

  it("payment initialize sends coupon only when valid for period", async () => {
    const source = await readFile(
      new URL("../../components/settings/membership-billing-panel.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /couponPreview\.interval === selectedBillingInterval/);
  });
});

describe("discount resolution recurring policy", () => {
  it("checks renewalAllowed on campaigns", async () => {
    const source = await readFile(
      new URL("./discount-resolution-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /renewalAllowed/);
    assert.match(source, /firstPaymentOnly/);
  });

  it("coupon renewal defaults blocked", async () => {
    const source = await readFile(
      new URL("../admin/promotions/coupon-mutation-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /renewalAllowed: parsed\.renewalAllowed \?\? false/);
  });
});
