import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSaleReceiptPaymentLines,
  buildSaleReceiptViewModel,
  resolveReceiptCustomerName,
} from "./sale-receipt-utils";

describe("sale receipt utils", () => {
  it("müşteri yoksa Perakende Müşteri yazar", () => {
    assert.equal(resolveReceiptCustomerName(null), "Perakende Müşteri");
    assert.equal(resolveReceiptCustomerName("  "), "Perakende Müşteri");
    assert.equal(resolveReceiptCustomerName("Ali"), "Ali");
  });

  it("veresiye satışta Cari'ye Yaz satırı ve kalan tutar üretir", () => {
    const lines = buildSaleReceiptPaymentLines({
      paymentStatus: "UNPAID",
      total: 1000,
      paidAmount: 0,
      payments: [],
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.label, "Cari'ye Yaz / Veresiye");
    assert.equal(lines[0]?.amount, 1000);
  });

  it("parçalı ödemede nakit + cari satırlarını birlikte gösterir", () => {
    const lines = buildSaleReceiptPaymentLines({
      paymentStatus: "PARTIAL",
      total: 1000,
      paidAmount: 400,
      payments: [
        {
          paymentMethod: "CASH",
          amount: 400,
          accountName: "Nakit Kasa",
        },
      ],
    });
    assert.equal(lines.length, 2);
    assert.match(lines[0]!.label, /Nakit/);
    assert.equal(lines[0]!.amount, 400);
    assert.equal(lines[1]!.label, "Cari'ye Yaz / Veresiye");
    assert.equal(lines[1]!.amount, 600);
  });

  it("kart satış ödemesini label ile gösterir", () => {
    const lines = buildSaleReceiptPaymentLines({
      paymentStatus: "PAID",
      total: 250,
      paidAmount: 250,
      payments: [
        {
          paymentMethod: "CARD",
          amount: 250,
          accountName: "POS Kart",
        },
      ],
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0]!.label, /Kart/);
  });

  it("view model SERVICE ürün ve iptal etiketini taşır", () => {
    const receipt = buildSaleReceiptViewModel({
      company: { name: "Test Market", phone: "0500" },
      sale: {
        saleNo: "POS-1",
        createdAt: new Date("2026-07-14T12:00:00.000Z"),
        status: "CANCELLED",
        paymentStatus: "UNPAID",
        subtotal: 100,
        vatTotal: 20,
        discount: 0,
        total: 120,
        paidAmount: 0,
        customerName: null,
        items: [
          {
            id: "i1",
            name: "Kurulum Hizmeti",
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
            lineTotal: 120,
          },
        ],
        payments: [],
      },
      widthMm: 58,
    });

    assert.equal(receipt.isCancelled, true);
    assert.equal(receipt.customerName, "Perakende Müşteri");
    assert.equal(receipt.items[0]?.name, "Kurulum Hizmeti");
    assert.equal(receipt.widthMm, 58);
    assert.equal(receipt.remainingAmount, 120);
  });
});
