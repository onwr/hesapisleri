import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addBillingPeriod,
  buildPriceTotals,
  calculateDiscountPercent,
  calculateMonthlyEquivalentMinor,
  calculateVatBreakdown,
  parseMoneyToMinor,
  salePriceFromPercent,
} from "./pricing-utils";

describe("pricing-utils", () => {
  it("479 TL → 47900 minor", () => {
    assert.equal(parseMoneyToMinor("479"), 47900);
    assert.equal(parseMoneyToMinor("479,00"), 47900);
  });

  it("indirim yüzdesi hesaplar", () => {
    const list = 143700;
    const sale = 129900;
    assert.equal(calculateDiscountPercent(list, sale), 9.6);
  });

  it("aylık eşdeğer hesaplar", () => {
    assert.equal(calculateMonthlyEquivalentMinor(129900, "QUARTERLY"), 43300);
    assert.equal(calculateMonthlyEquivalentMinor(47900, "MONTHLY"), 47900);
  });

  it("KDV hariç toplam", () => {
    const vat = calculateVatBreakdown({
      salePriceMinor: 47900,
      vatRate: 20,
      vatIncluded: false,
    });
    assert.equal(vat.subtotalMinor, 47900);
    assert.equal(vat.vatMinor, 9580);
    assert.equal(vat.totalMinor, 57480);
  });

  it("KDV dahil toplam", () => {
    const vat = calculateVatBreakdown({
      salePriceMinor: 47900,
      vatRate: 20,
      vatIncluded: true,
    });
    assert.equal(vat.totalMinor, 47900);
    assert.ok(vat.subtotalMinor < 47900);
  });

  it("buildPriceTotals örnek yıllık paket", () => {
    const totals = buildPriceTotals({
      listPriceMinor: 574800,
      salePriceMinor: 479000,
      interval: "YEARLY",
      vatRate: 20,
      vatIncluded: false,
    });
    assert.equal(totals.discountPercent, 16.7);
    assert.equal(totals.monthlyEquivalentMinor, 39917);
  });

  it("salePriceFromPercent", () => {
    assert.equal(salePriceFromPercent(143700, 10), 129330);
  });

  it("addBillingPeriod ay sonu", () => {
    const result = addBillingPeriod(new Date("2026-01-31T12:00:00"), "MONTHLY");
    assert.equal(result.getMonth(), 1);
    assert.equal(result.getDate(), 28);
  });
});
