import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPosSaleItemTotal,
  calculatePosTotals,
  mapPosPaymentMethodToCollectionMethod,
  posRequiresCollectionAccount,
} from "./pos-checkout-utils";
import { getCustomerDebtDelta as getDebt } from "./customer-balance-utils";
import { resolveSalePayment } from "./sale-payment-utils";

describe("pos checkout utils", () => {
  it("ürün toplamını KDV dahil hesaplar", () => {
    const total = buildPosSaleItemTotal({
      quantity: 2,
      unitPrice: 100,
      vatRate: 20,
    });

    assert.equal(total, 240);
  });

  it("indirim genel toplamı aşamaz", () => {
    const totals = calculatePosTotals(
      [{ quantity: 1, unitPrice: 100, vatRate: 20 }],
      500
    );

    assert.equal(totals.discount, 120);
    assert.equal(totals.total, 0);
  });

  it("nakit ve kart tahsilatı kasa hesabına gider", () => {
    assert.equal(mapPosPaymentMethodToCollectionMethod("CASH"), "CASH");
    assert.equal(mapPosPaymentMethodToCollectionMethod("CARD"), "CASH");
    assert.equal(
      mapPosPaymentMethodToCollectionMethod("BANK_TRANSFER"),
      "BANK"
    );
  });

  it("PAID satışta tahsilat hesabı gerekir", () => {
    assert.equal(posRequiresCollectionAccount("PAID", 100), true);
    assert.equal(posRequiresCollectionAccount("UNPAID", 0), false);
    assert.equal(posRequiresCollectionAccount("PARTIAL", 50), true);
  });

  it("PAID satışta cari değişmez", () => {
    const payment = resolveSalePayment({
      paymentStatus: "PAID",
      total: 1000,
    });

    assert.equal(payment.paymentStatus, "PAID");
    assert.equal(payment.paidAmount, 1000);
    assert.equal(getDebt(1000, payment.paidAmount), 0);
  });

  it("UNPAID satışta cari toplam kadar artar", () => {
    const payment = resolveSalePayment({
      paymentStatus: "UNPAID",
      total: 1000,
    });

    assert.equal(payment.paymentStatus, "UNPAID");
    assert.equal(payment.paidAmount, 0);
    assert.equal(getDebt(1000, payment.paidAmount), 1000);
  });

  it("PARTIAL satışta cari kalan kadar artar", () => {
    const payment = resolveSalePayment({
      paymentStatus: "PARTIAL",
      total: 1000,
      collectedAmount: 400,
    });

    assert.equal(payment.paymentStatus, "PARTIAL");
    assert.equal(payment.paidAmount, 400);
    assert.equal(getDebt(1000, payment.paidAmount), 600);
  });

  it("kısmi ödeme tutarı toplamdan büyükse PAID olur", () => {
    const payment = resolveSalePayment({
      paymentStatus: "PARTIAL",
      total: 500,
      collectedAmount: 600,
    });

    assert.equal(payment.paymentStatus, "PAID");
    assert.equal(payment.paidAmount, 500);
  });

  it("kısmi ödeme tutarı sıfırsa hata verir", () => {
    assert.throws(() =>
      resolveSalePayment({
        paymentStatus: "PARTIAL",
        total: 500,
        collectedAmount: 0,
      })
    );
  });
});
