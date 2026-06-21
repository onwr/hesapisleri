import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildInvoiceDetailView } from "./invoice-detail-utils";

describe("buildInvoiceDetailView", () => {
  it("InvoiceItem snapshot alanlarını kullanır", () => {
    const view = buildInvoiceDetailView(
      {
        id: "inv-1",
        invoiceNo: "FTR-2026-0001",
        type: "NORMAL",
        status: "SENT",
        paymentStatus: "UNPAID",
        total: 236,
        subtotal: 200,
        totalDiscount: 0,
        taxableAmount: 200,
        totalVat: 36,
        financialSnapshotStatus: "COMPLETE",
        createdAt: new Date("2026-01-01"),
        dueDate: null,
        gibStatus: null,
        gibMessage: null,
        pdfUrl: null,
        saleId: null,
        customer: null,
        company: {
          name: "Demo",
          taxNo: null,
          address: null,
        },
      },
      {
        dbItems: [
          {
            id: "item-1",
            invoiceId: "inv-1",
            productId: "prod-1",
            sourceSaleItemId: null,
            productName: "Ürün A",
            description: null,
            sku: null,
            barcode: null,
            unit: null,
            quantity: 2 as unknown as never,
            unitPrice: 100 as unknown as never,
            discountRate: 0 as unknown as never,
            discountAmount: 0 as unknown as never,
            lineNetAmount: 200 as unknown as never,
            vatRate: 18 as unknown as never,
            vatAmount: 36 as unknown as never,
            lineGrossAmount: 236 as unknown as never,
            lineIndex: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }
    );

    assert.equal(view.items[0]?.vatRate, 18);
    assert.equal(view.items[0]?.vatAmount, 36);
    assert.equal(view.totals.vatTotal, 36);
    assert.equal(view.usesStoredSnapshot, true);
  });

  it("meta snapshot toplamlarını yeniden hesaplamadan kullanır", () => {
    const view = buildInvoiceDetailView({
      id: "inv-2",
      invoiceNo: "FTR-2026-0002",
      type: "NORMAL",
      status: "SENT",
      paymentStatus: "UNPAID",
      total: 236,
      createdAt: new Date("2026-01-01"),
      dueDate: null,
      gibStatus: null,
      gibMessage:
        'Gönderildi.|META|' +
        encodeURIComponent(
          JSON.stringify({
            v: 1,
            documentLabel: "SATIS",
            currency: "TRY",
            invoiceDate: "2026-01-01",
            discountAmount: 0,
            subtotal: 200,
            taxableAmount: 200,
            totalVat: 36,
            grandTotal: 236,
            items: [
              {
                name: "Ürün A",
                quantity: 2,
                unitPrice: 100,
                vatRate: 18,
                lineNetAmount: 200,
                vatAmount: 36,
                lineGrossAmount: 236,
              },
            ],
          })
        ),
      pdfUrl: null,
      saleId: null,
      customer: null,
      company: {
        name: "Demo",
        taxNo: null,
        address: null,
      },
    });

    assert.equal(view.totals.vatTotal, 36);
    assert.equal(view.items[0]?.vatRate, 18);
  });
});
