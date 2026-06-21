import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  calculateLineSubtotal,
  calculateLineTotal,
  calculateLineVat,
  calculateSaleTotals,
  parseSaleUnitPriceInput,
  parseSaleVatRateInput,
  validateSaleLineItem,
  validateSaleLineItems,
} from "./sale-calculation-utils";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");

describe("sale line calculation", () => {
  const item = { quantity: 2, unitPrice: 100, vatRate: 20 };

  it("unitPrice değişince toplam değişir", () => {
    assert.equal(calculateLineSubtotal(item), 200);
    assert.equal(
      calculateLineSubtotal({ ...item, unitPrice: 80 }),
      160
    );
  });

  it("vatRate değişince KDV toplamı değişir", () => {
    assert.equal(calculateLineVat(item), 40);
    assert.equal(calculateLineVat({ ...item, vatRate: 10 }), 20);
  });

  it("satır toplamı subtotal + KDV", () => {
    assert.equal(calculateLineTotal(item), 240);
  });

  it("global discount net toplamı değiştirir", () => {
    const totals = calculateSaleTotals(
      [{ quantity: 1, unitPrice: 100, vatRate: 20 }],
      { type: "AMOUNT", value: 24 }
    );
    assert.equal(totals.gross, 120);
    assert.equal(totals.total, 96);
  });

  it("birim fiyat ve KDV doğrulaması", () => {
    assert.equal(
      validateSaleLineItem({ quantity: 1, unitPrice: -1, vatRate: 20 }),
      "Birim fiyat geçersiz."
    );
    assert.equal(
      validateSaleLineItem({ quantity: 1, unitPrice: 10, vatRate: 120 }),
      "KDV oranı 0 ile 100 arasında olmalıdır."
    );
    assert.equal(validateSaleLineItems([item]), null);
  });

  it("Türkçe para formatını parse eder", () => {
    assert.equal(parseSaleUnitPriceInput("1.250,75"), 1250.75);
    assert.equal(parseSaleVatRateInput("18"), 18);
    assert.equal(parseSaleVatRateInput(101), null);
  });
});

describe("sale line editing ui", () => {
  it("POS sepetinde fiyat/KDV düzenleme alanları görünür", () => {
    const panel = read("components/pos/pos-cart-panel.tsx");
    assert.match(panel, /SaleLineEditFields/);
    assert.match(panel, /onUnitPriceChange/);
    assert.match(panel, /onVatRateChange/);
    assert.match(panel, /Bu satışa özel fiyat/);
  });

  it("Yeni Satış sepetinde fiyat/KDV düzenleme alanları görünür", () => {
    const page = read("app/sales/new/page.tsx");
    assert.match(page, /SaleLineEditFields/);
    assert.match(page, /updateCartItem/);
    assert.match(page, /validateSaleLineItems/);
  });

  it("Teklif ekranlarında fiyat/KDV düzenleme alanları görünür", () => {
    const quoteNew = read("app/sales/quotes/new/page.tsx");
    const quoteEdit = read("app/sales/quotes/[id]/edit/edit-quote-form.tsx");
    assert.match(quoteNew, /SaleLineEditFields/);
    assert.match(quoteEdit, /SaleLineEditFields/);
  });

  it("satış API unitPrice override kaydeder, product güncellemez", () => {
    const route = read("app/api/sales/create/route.ts");
    assert.match(route, /unitPrice: item\.unitPrice/);
    assert.match(route, /validateSaleLineItems/);
    assert.doesNotMatch(route, /sellPrice/);
    assert.doesNotMatch(route, /product\.update/);
  });

  it("POS checkout satır doğrulaması kullanır", () => {
    const service = read("lib/pos-checkout-service.ts");
    assert.match(service, /validateSaleLineItems/);
  });
});
