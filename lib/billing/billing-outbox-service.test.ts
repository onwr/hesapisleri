import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBillingNotification } from "@/lib/billing/billing-outbox-notifications";

describe("billing outbox notifications", () => {
  it("maps subscription trial extended event", () => {
    const notification = buildBillingNotification(
      "SUBSCRIPTION_TRIAL_EXTENDED",
      "sub-1"
    );
    assert.ok(notification);
    assert.equal(notification?.title, "Deneme süresi uzatıldı");
  });

  it("maps price locked event", () => {
    const notification = buildBillingNotification(
      "SUBSCRIPTION_PRICE_LOCKED",
      "sub-1"
    );
    assert.ok(notification);
    assert.equal(notification?.title, "Fiyat kilitlendi");
  });

  it("maps manually extended event", () => {
    const notification = buildBillingNotification(
      "SUBSCRIPTION_MANUALLY_EXTENDED",
      "sub-1"
    );
    assert.ok(notification);
    assert.equal(notification?.title, "Abonelik uzatıldı");
  });
});
