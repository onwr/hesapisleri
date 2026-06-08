import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney, formatNumber, formatPercent } from "./format-utils";

describe("formatMoney", () => {
  it("formatMoney(1000) → ₺1.000,00", () => {
    assert.equal(formatMoney(1000), "₺1.000,00");
  });

  it("formatMoney(10000.5) → ₺10.000,50", () => {
    assert.equal(formatMoney(10000.5), "₺10.000,50");
  });

  it("formatMoney(10.5) → ₺10,50", () => {
    assert.equal(formatMoney(10.5), "₺10,50");
  });

  it("formatMoney(0) → ₺0,00", () => {
    assert.equal(formatMoney(0), "₺0,00");
  });

  it("formatMoney(null) → ₺0,00", () => {
    assert.equal(formatMoney(null), "₺0,00");
  });

  it("formatMoney(undefined) → ₺0,00", () => {
    assert.equal(formatMoney(undefined), "₺0,00");
  });

  it("formatMoney(-1250.5) → -₺1.250,50", () => {
    assert.equal(formatMoney(-1250.5), "-₺1.250,50");
  });

  it('formatMoney("2500.75") → ₺2.500,75', () => {
    assert.equal(formatMoney("2500.75"), "₺2.500,75");
  });
});

describe("formatNumber", () => {
  it("formatNumber(1000) → 1.000", () => {
    assert.equal(formatNumber(1000), "1.000");
  });

  it("formatNumber(10000) → 10.000", () => {
    assert.equal(formatNumber(10000), "10.000");
  });
});

describe("formatPercent", () => {
  it("formatPercent(12.5) → %12,50", () => {
    assert.equal(formatPercent(12.5), "%12,50");
  });
});
