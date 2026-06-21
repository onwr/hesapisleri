import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInvoiceFinancialConsistency,
  calculateInvoiceLineSnapshots,
  calculateInvoiceTotals,
  calculateInvoiceTotalsFromSnapshots,
  isInvoiceFinanciallyImmutable,
  normalizeVatRate,
} from "./invoice-tax-calculation-utils";

describe("invoice tax calculation utils", () => {
  it("normalizeVatRate geçerli oranları kabul eder", () => {
    assert.equal(normalizeVatRate(18), 18);
    assert.equal(normalizeVatRate("20"), 20);
    assert.equal(normalizeVatRate(-1), 0);
  });

  it("%18 KDV ile satır snapshot hesaplar", () => {
    const lines = calculateInvoiceLineSnapshots(
      [{ quantity: 2, unitPrice: 100, vatRate: 18 }],
      0
    );

    assert.equal(lines[0]?.lineNetAmount, 200);
    assert.equal(lines[0]?.vatAmount, 36);
    assert.equal(lines[0]?.lineGrossAmount, 236);
  });

  it("belge toplamları satır snapshot toplamıyla tutarlı", () => {
    const lines = calculateInvoiceLineSnapshots(
      [
        { quantity: 1, unitPrice: 100, vatRate: 18 },
        { quantity: 1, unitPrice: 200, vatRate: 20 },
      ],
      30
    );
    const totals = calculateInvoiceTotalsFromSnapshots(lines);
    const consistency = assertInvoiceFinancialConsistency({
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      taxableAmount: totals.taxableAmount,
      totalVat: totals.totalVat,
      grandTotal: totals.grandTotal,
      items: lines,
    });

    assert.equal(consistency.ok, true);
  });

  it("ürün KDV değişse bile snapshot oranı sabit kalır", () => {
    const original = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 100, vatRate: 18 }],
      0
    );

    const afterProductChange = calculateInvoiceTotals(
      [{ quantity: 1, unitPrice: 100, vatRate: 20 }],
      0
    );

    assert.equal(original.totalVat, 18);
    assert.equal(afterProductChange.totalVat, 20);
    assert.notEqual(original.total, afterProductChange.total);
  });

  it("floating point sapması oluşmaz", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 3, unitPrice: 0.1, vatRate: 20 }],
      0
    );

    assert.equal(Number.isFinite(totals.totalVat), true);
    assert.equal(totals.totalVat, 0.06);
  });

  it("kesinleşmiş fatura durumları immutable", () => {
    assert.equal(isInvoiceFinanciallyImmutable("SENT"), true);
    assert.equal(isInvoiceFinanciallyImmutable("APPROVED"), true);
    assert.equal(isInvoiceFinanciallyImmutable("CANCELLED"), true);
    assert.equal(isInvoiceFinanciallyImmutable("DRAFT"), false);
  });
});
