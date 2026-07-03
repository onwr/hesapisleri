import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSipayUrl, SIPAY_ENDPOINTS } from "./sipay-endpoints";
import { SIPAY_LIVE_API_BASE, SIPAY_TEST_API_BASE } from "./sipay-env";

describe("sipay-endpoints — buildSipayUrl", () => {
  it("live base + token path tam URL üretir", () => {
    assert.equal(
      buildSipayUrl(SIPAY_LIVE_API_BASE, SIPAY_ENDPOINTS.TOKEN),
      "https://app.sipay.com.tr/ccpayment/api/token",
    );
  });

  it("test base + purchase path tam URL üretir", () => {
    assert.equal(
      buildSipayUrl(SIPAY_TEST_API_BASE, SIPAY_ENDPOINTS.PURCHASE_LINK),
      "https://provisioning.sipay.com.tr/ccpayment/purchase/link",
    );
  });

  it("legacy domain kökü normalize edilir", () => {
    assert.equal(
      buildSipayUrl("https://app.sipay.com.tr", SIPAY_ENDPOINTS.CHECKSTATUS),
      "https://app.sipay.com.tr/ccpayment/api/checkstatus",
    );
  });

  it("çift /ccpayment path reddedilir", () => {
    assert.throws(
      () => buildSipayUrl(SIPAY_LIVE_API_BASE, "/ccpayment/api/token"),
      /must not include \/ccpayment prefix/,
    );
  });
});
