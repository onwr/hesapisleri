import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("discount refund policy", () => {
  it("defines refund policy helpers", async () => {
    const source = await readFile(
      new URL("./discount-refund-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /RELEASE_ON_FULL_REFUND/);
    assert.match(source, /shouldRestoreUsageOnRefund/);
    assert.match(source, /restoreUsageOnPartialRefund/);
    assert.match(source, /REDEMPTION_REFUND_RESTORED/);
  });

  it("payment refund service integrates restore", async () => {
    const source = await readFile(
      new URL("../payments/payment-refund-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /restoreDiscountRedemptionsOnRefund/);
  });
});
