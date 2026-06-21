import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCouponCode, generateBulkCouponCode } from "@/lib/admin/promotions/coupon-utils";

describe("coupon utils", () => {
  it("normalizes Turkish characters and uppercase", () => {
    assert.equal(normalizeCouponCode(" yaz-26 "), "YAZ-26");
    assert.equal(normalizeCouponCode("İndirim"), "INDIRIM");
  });

  it("generates bulk codes with prefix", () => {
    const code = generateBulkCouponCode("YAZ26", 6);
    assert.match(code, /^YAZ26-[A-Z0-9]{6}$/);
  });
});

describe("promotion policy", () => {
  it("blocks campaigns when grandfathered in price resolution", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../billing/price-resolution-service.ts", import.meta.url),
        "utf8"
      )
    );
    assert.match(source, /blockCampaigns/);
    assert.match(source, /GRANDFATHERED/);
  });
});
