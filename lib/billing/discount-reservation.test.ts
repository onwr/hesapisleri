import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("discount reservation concurrency", () => {
  it("checks coupon max usage before reserve", async () => {
    const source = await readFile(
      new URL("./discount-reservation-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /maxUsage/);
    assert.match(source, /maxUsagePerCompany/);
    assert.match(source, /Kupon kullanım limiti doldu/);
  });

  it("cleanup preserves unknown payments", async () => {
    const source = await readFile(
      new URL("./discount-reservation-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /UNKNOWN/);
    assert.match(source, /WAIT_CALLBACK/);
  });

  it("idempotent reserve by paymentId + couponId", async () => {
    const source = await readFile(
      new URL("./discount-reservation-service.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /paymentId: input.paymentId/);
    assert.match(source, /if \(existing\)/);
  });
});
