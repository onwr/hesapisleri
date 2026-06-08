import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getInvoiceRemainingAmount,
  normalizeInvoicePaymentFields,
  previewInvoicePaymentStatus,
  resolveInvoicePaidState,
  validateInvoiceCancelEligibility,
  validateInvoiceCollectEligibility,
} from "./invoice-payment-utils";

describe("invoice payment utils", () => {
  it("PAID faturada paidAmount total'e eşitlenir", () => {
    const result = normalizeInvoicePaymentFields({
      total: 1000,
      paymentStatus: "PAID",
      paidAmount: 0,
    });

    assert.equal(result.paidAmount, 1000);
    assert.equal(result.paymentStatus, "PAID");
  });

  it("UNPAID faturada paidAmount sıfırdır", () => {
    const result = normalizeInvoicePaymentFields({
      total: 1000,
      paymentStatus: "UNPAID",
      paidAmount: 500,
    });

    assert.equal(result.paidAmount, 0);
    assert.equal(result.paymentStatus, "UNPAID");
  });

  it("PARTIAL faturada paidAmount total'den küçüktür", () => {
    const result = normalizeInvoicePaymentFields({
      total: 1000,
      paymentStatus: "PARTIAL",
      paidAmount: 400,
    });

    assert.equal(result.paidAmount, 400);
    assert.equal(result.paymentStatus, "PARTIAL");
  });

  it("UNPAID fatura tahsil edilebilir", () => {
    const result = validateInvoiceCollectEligibility({
      status: "SENT",
      paymentStatus: "UNPAID",
      total: 500,
      paidAmount: 0,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.remaining, 500);
    }
  });

  it("PAID fatura tekrar tahsil edilemez", () => {
    const result = validateInvoiceCollectEligibility({
      status: "SENT",
      paymentStatus: "PAID",
      total: 500,
      paidAmount: 500,
    });

    assert.equal(result.ok, false);
  });

  it("CANCELLED fatura tahsil edilemez", () => {
    const result = validateInvoiceCollectEligibility({
      status: "CANCELLED",
      paymentStatus: "UNPAID",
      total: 500,
      paidAmount: 0,
    });

    assert.equal(result.ok, false);
  });

  it("fazla tahsilat remaining ile sınırlanır", () => {
    const remaining = getInvoiceRemainingAmount(500, 200);
    assert.equal(remaining, 300);
  });

  it("kısmi tahsilat sonrası PARTIAL durumuna geçer", () => {
    const preview = previewInvoicePaymentStatus(1000, 200, 300);
    assert.equal(preview.paymentStatus, "PARTIAL");
    assert.equal(preview.paidAmount, 500);
  });

  it("tam tahsilat sonrası PAID olur", () => {
    const state = resolveInvoicePaidState(1000, 1000);
    assert.equal(state.paymentStatus, "PAID");
    assert.equal(state.paidAmount, 1000);
  });

  it("tahsilatlı fatura iptal edilemez", () => {
    const result = validateInvoiceCancelEligibility({
      status: "SENT",
      paymentStatus: "PARTIAL",
      total: 1000,
      paidAmount: 300,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message.toLocaleLowerCase("tr-TR"), /tahsilat/);
    }
  });

  it("UNPAID manuel fatura iptal edilebilir", () => {
    const result = validateInvoiceCancelEligibility({
      status: "SENT",
      paymentStatus: "UNPAID",
      total: 1000,
      paidAmount: 0,
    });

    assert.equal(result.ok, true);
  });
});
