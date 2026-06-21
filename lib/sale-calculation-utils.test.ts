import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateSaleDiscountAmount,
  calculateSaleTotals,
  parseSaleDiscountValueInput,
  resolveSaleDiscountInput,
  validateSaleDiscountInput,
} from "./sale-calculation-utils";

const sampleItems = [{ quantity: 1, unitPrice: 1000, vatRate: 0 }];

describe("sale calculation utils", () => {
  it("tutar indirimi hesaplanır", () => {
    const totals = calculateSaleTotals(sampleItems, {
      type: "AMOUNT",
      value: 100,
    });

    assert.equal(totals.subtotal, 1000);
    assert.equal(totals.discount, 100);
    assert.equal(totals.total, 900);
  });

  it("yüzde indirimi hesaplanır", () => {
    const totals = calculateSaleTotals(sampleItems, {
      type: "PERCENT",
      value: 10,
    });

    assert.equal(totals.discount, 100);
    assert.equal(totals.total, 900);
  });

  it("indirim toplamı aşamaz", () => {
    const totals = calculateSaleTotals(sampleItems, {
      type: "AMOUNT",
      value: 5000,
    });

    assert.equal(totals.discount, 1000);
    assert.equal(totals.total, 0);
  });

  it("boş indirim 0 olur", () => {
    const totals = calculateSaleTotals(sampleItems);
    assert.equal(totals.discount, 0);
    assert.equal(totals.total, 1000);
  });

  it("Türkçe para formatını parse eder", () => {
    assert.equal(parseSaleDiscountValueInput("1.250,75"), 1250.75);
    assert.equal(parseSaleDiscountValueInput("350"), 350);
    assert.equal(parseSaleDiscountValueInput("350,50"), 350.5);
  });

  it("yüzde doğrulaması", () => {
    assert.equal(
      validateSaleDiscountInput(1000, { type: "PERCENT", value: 120 }),
      "İndirim yüzdesi 0 ile 100 arasında olmalıdır."
    );
    assert.equal(
      validateSaleDiscountInput(1000, { type: "AMOUNT", value: 1200 }),
      "İndirim tutarı satış toplamını aşamaz."
    );
  });

  it("resolveSaleDiscountInput POS amount uyumluluğu", () => {
    assert.deepEqual(resolveSaleDiscountInput({ discount: 50 }), {
      type: "AMOUNT",
      value: 50,
    });
    assert.deepEqual(
      resolveSaleDiscountInput({ discountType: "PERCENT", discountValue: 15 }),
      { type: "PERCENT", value: 15 }
    );
  });

  it("KDV dahil gross üzerinden indirim uygular", () => {
    const totals = calculateSaleTotals(
      [{ quantity: 1, unitPrice: 100, vatRate: 20 }],
      { type: "AMOUNT", value: 120 }
    );

    assert.equal(totals.gross, 120);
    assert.equal(calculateSaleDiscountAmount(120, { type: "AMOUNT", value: 120 }), 120);
    assert.equal(totals.total, 0);
  });
});
