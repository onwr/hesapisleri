import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSipayHttpDebugEnabled,
  safeSipayRequestContext,
  safeSipayResponseSummary,
} from "./sipay-http-debug";

describe("sipay http debug", () => {
  it("token isteğinde secret alanları context'e girmez", () => {
    const context = safeSipayRequestContext({
      app_id: "app-1",
      app_secret: "super-secret",
      invoice_id: "SI-123",
      merchant_key: "key",
      hashKey: "hash",
    });

    assert.equal(context.invoiceId, "SI-123");
    assert.equal((context as { app_secret?: string }).app_secret, undefined);
  });

  it("response özeti status_code ve payment_status içerir", () => {
    const summary = safeSipayResponseSummary({
      status_code: 69,
      status_description: "Pending",
      data: {
        payment_status: 0,
        transaction_status: "Pending",
        invoice_id: "SI-123",
        error_code: "E1",
      },
    });

    assert.equal(summary.statusCode, 69);
    assert.equal(summary.statusDescription, "Pending");
    assert.equal(summary.paymentStatus, 0);
    assert.equal(summary.transactionStatus, "Pending");
    assert.equal(summary.invoiceId, "SI-123");
    assert.equal(summary.errorCode, "E1");
  });

  it("SIPAY_HTTP_DEBUG=false production dışı override", () => {
    const prev = process.env.SIPAY_HTTP_DEBUG;
    process.env.SIPAY_HTTP_DEBUG = "false";
    try {
      assert.equal(isSipayHttpDebugEnabled(), false);
    } finally {
      if (prev === undefined) delete process.env.SIPAY_HTTP_DEBUG;
      else process.env.SIPAY_HTTP_DEBUG = prev;
    }
  });
});
