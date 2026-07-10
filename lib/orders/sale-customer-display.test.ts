import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMarketplaceBuyerFromOrderNote,
  resolveSaleCustomerDisplay,
} from "@/lib/orders/sale-customer-display";

describe("marketplace sale customer display", () => {
  it("pazaryeri siparişinde alıcı adı orderNote'dan gösterilir", () => {
    const display = resolveSaleCustomerDisplay({
      sourceChannel: "TRENDYOL",
      externalOrderId: "TY-123",
      orderNote: "Alıcı: Ayşe Yılmaz. Pazaryeri siparişi (TRENDYOL).",
      customer: { name: "Trendyol Müşterileri", phone: null },
    });

    assert.equal(display.customerName, "Ayşe Yılmaz");
    assert.equal(display.localCustomerMatched, false);
    assert.match(display.customerSubName ?? "", /TY-123/);
  });

  it("pazaryeri siparişinde yanlış Müşteri seçilmedi gösterilmez", () => {
    const display = resolveSaleCustomerDisplay({
      sourceChannel: "HEPSIBURADA",
      externalOrderId: "HB-9",
      orderNote: "Pazaryeri siparişi (HEPSIBURADA).",
      customer: { name: "Hepsiburada Müşterileri", phone: null },
    });

    assert.notEqual(display.customerName, "Müşteri seçilmedi");
    assert.equal(display.customerName, "Hepsiburada alıcısı");
  });

  it("manuel siparişte müşteri yoksa Müşteri seçilmedi kalır", () => {
    const display = resolveSaleCustomerDisplay({
      sourceChannel: "MANUAL",
      externalOrderId: null,
      orderNote: null,
      customer: null,
    });

    assert.equal(display.customerName, "Müşteri seçilmedi");
  });

  it("orderNote alıcı parse", () => {
    assert.equal(
      extractMarketplaceBuyerFromOrderNote("Alıcı: Mehmet Demir. Tel: 555."),
      "Mehmet Demir"
    );
  });
});
