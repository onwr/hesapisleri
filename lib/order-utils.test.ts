import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canTransitionOrderStatus,
  getSourceChannelLabel,
  mapOrderStatusToLabel,
  orderStatusesForTab,
  validateShippingFields,
} from "./order-utils";
import { mapSaleToOrderRow } from "./orders-page-utils";

describe("order-utils", () => {
  it("MANUAL kanalı Manuel Satış etiketi döner", () => {
    assert.equal(getSourceChannelLabel("MANUAL"), "Manuel Satış");
  });

  it("paymentStatus PAID orderStatus DELIVERED yapmaz", () => {
    const row = mapSaleToOrderRow({
      id: "sale-1",
      saleNo: "S-1001",
      total: 1000,
      paymentStatus: "PAID",
      sourceChannel: "MANUAL",
      externalOrderId: null,
      orderStatus: "APPROVED",
      shippingCarrier: null,
      trackingNumber: null,
      shippedAt: null,
      deliveredAt: null,
      createdAt: new Date("2026-01-01"),
      customer: { name: "Test", phone: null },
      items: [{}],
    });

    assert.equal(row.status, "Onaylandı");
    assert.equal(row.paymentStatus, "PAID");
  });

  it("orderStatus SHIPPING doğru badge üretir", () => {
    assert.equal(mapOrderStatusToLabel("SHIPPING"), "Kargoda");
  });

  it("geçersiz status transition engellenir", () => {
    assert.equal(canTransitionOrderStatus("WAITING", "DELIVERED"), false);
    assert.equal(canTransitionOrderStatus("APPROVED", "SHIPPING"), true);
  });

  it("SHIPPING için trackingNumber zorunlu", () => {
    assert.equal(
      validateShippingFields({
        shippingCarrier: "Aras Kargo",
        trackingNumber: "",
      }).ok,
      false
    );

    assert.equal(
      validateShippingFields({
        shippingCarrier: "Aras Kargo",
        trackingNumber: "123456",
      }).ok,
      true
    );
  });

  it("sahte kargo kodu üretmez", () => {
    const row = mapSaleToOrderRow({
      id: "sale-2",
      saleNo: "S-1002",
      total: 500,
      paymentStatus: "UNPAID",
      sourceChannel: "TRENDYOL",
      externalOrderId: "TY-1",
      orderStatus: "APPROVED",
      shippingCarrier: null,
      trackingNumber: null,
      shippedAt: null,
      deliveredAt: null,
      createdAt: new Date("2026-01-02"),
      customer: null,
      items: [],
    });

    assert.equal(row.cargo, "—");
    assert.equal(row.cargoCode, null);
    assert.equal(row.channel, "TRENDYOL");
  });

  it("tab waiting sadece WAITING getirir", () => {
    assert.deepEqual(orderStatusesForTab("waiting"), ["WAITING"]);
  });

  it("tab shipping sadece SHIPPING getirir", () => {
    assert.deepEqual(orderStatusesForTab("shipping"), ["SHIPPING"]);
  });

  it("returns RETURN_REQUESTED RETURNED CANCELLED getirir", () => {
    assert.deepEqual(orderStatusesForTab("returns"), [
      "RETURN_REQUESTED",
      "RETURNED",
      "CANCELLED",
    ]);
  });
});
