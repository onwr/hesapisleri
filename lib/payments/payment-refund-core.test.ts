/**
 * Refund core — gerçek servis davranış testleri (DB mock yok, saf fonksiyonlar).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validateRefundPaymentEligibility,
  validateRefundRequestAmount,
  validateRefundReason,
  resolveRefundPaymentStatus,
  assertRefundStateTransition,
  PaymentRefundValidationError,
} from "./payment-refund-core.js";
import {
  sumCompletedRefundsMinor,
  sumPendingRefundsMinor,
  getMaxRefundableMinor,
  reconcileRefundedAmountMinor,
} from "../admin/payments/admin-payment-refund-utils.js";
import { redactProviderRefundResponse } from "./payment-refund-redaction.js";

const basePayment = {
  id: "pay-1",
  companyId: "co-1",
  subscriptionId: "sub-1",
  status: "PAID" as const,
  providerEnum: "PAYTR",
  merchantOid: "MO123",
  amountMinor: 10000,
  currency: "TRY",
  refundedAmountMinor: 0,
};

function refundRow(
  status: string,
  amountMinor: number,
  completedAt: Date | null = new Date()
) {
  return { status, amountMinor, currency: "TRY", completedAt };
}

describe("refund source of truth", () => {
  it("SUCCEEDED + completedAt toplama girer", () => {
    const total = sumCompletedRefundsMinor(
      [refundRow("SUCCEEDED", 2500), refundRow("SUCCEEDED", 1500)],
      "TRY"
    );
    assert.equal(total, 4000);
  });

  it("PENDING/PROCESSING finansal toplama girmez", () => {
    const total = sumCompletedRefundsMinor(
      [refundRow("PROCESSING", 5000, null), refundRow("REQUESTED", 2000, null)],
      "TRY"
    );
    assert.equal(total, 0);
    assert.equal(sumPendingRefundsMinor(
      [refundRow("PROCESSING", 5000, null)],
      "TRY"
    ), 5000);
  });

  it("FAILED finansal toplama girmez", () => {
    assert.equal(sumCompletedRefundsMinor([refundRow("FAILED", 9000, null)], "TRY"), 0);
  });

  it("snapshot field ile çift sayım yapmaz", () => {
    const r = reconcileRefundedAmountMinor({
      payment: { amountMinor: 10000, currency: "TRY", refundedAmountMinor: 3000, status: "PARTIALLY_REFUNDED" },
      refunds: [refundRow("SUCCEEDED", 3000)],
    });
    assert.equal(r.fromRefunds, 3000);
    assert.equal(r.mismatch, false);
  });

  it("partial refund doğru hesaplanır", () => {
    assert.equal(resolveRefundPaymentStatus(10000, 0, 4000), "PARTIALLY_REFUNDED");
    assert.equal(resolveRefundPaymentStatus(10000, 6000, 4000), "REFUNDED");
  });

  it("ikinci partial kalan tutarı aşamaz", () => {
    const refunds = [refundRow("SUCCEEDED", 6000)];
    assert.throws(() =>
      validateRefundRequestAmount({
        payment: { ...basePayment, status: "PARTIALLY_REFUNDED", refundedAmountMinor: 6000 },
        requestedMinor: 5000,
        refundCurrency: "TRY",
        refunds,
      }),
      PaymentRefundValidationError
    );
  });

  it("full refund sonrası yeni refund reddedilir", () => {
    assert.throws(
      () =>
        validateRefundPaymentEligibility({
          ...basePayment,
          status: "REFUNDED",
          refundedAmountMinor: 10000,
        }),
      (e: unknown) => e instanceof PaymentRefundValidationError && e.code === "INVALID_PAYMENT_STATUS"
    );
  });

  it("refund toplamı amountMinor aşamaz", () => {
    assert.throws(() =>
      validateRefundRequestAmount({
        payment: basePayment,
        requestedMinor: 10001,
        refundCurrency: "TRY",
        refunds: [],
      }),
      (e: unknown) => e instanceof PaymentRefundValidationError && e.code === "REFUND_OVERFLOW"
    );
  });

  it("currency mismatch reddedilir", () => {
    assert.throws(() =>
      validateRefundRequestAmount({
        payment: basePayment,
        requestedMinor: 100,
        refundCurrency: "USD",
        refunds: [],
      }),
      (e: unknown) => e instanceof PaymentRefundValidationError && e.code === "CURRENCY_MISMATCH"
    );
  });

  it("MANUAL provider reddedilir", () => {
    assert.throws(
      () =>
        validateRefundPaymentEligibility({
          ...basePayment,
          providerEnum: "MANUAL",
          merchantOid: null,
        }),
      (e: unknown) =>
        e instanceof PaymentRefundValidationError && e.code === "PROVIDER_NOT_SUPPORTED"
    );
  });

  it("LEGACY provider reddedilir", () => {
    assert.throws(
      () => validateRefundPaymentEligibility({ ...basePayment, providerEnum: "LEGACY" }),
      PaymentRefundValidationError
    );
  });

  it("concurrent pending talepleri overflow oluşturmaz", () => {
    const refunds = [refundRow("PROCESSING", 7000, null)];
    const max = getMaxRefundableMinor({
      paymentAmountMinor: 10000,
      currency: "TRY",
      refunds,
    });
    assert.equal(max, 3000);
    assert.throws(() =>
      validateRefundRequestAmount({
        payment: basePayment,
        requestedMinor: 4000,
        refundCurrency: "TRY",
        refunds,
      })
    );
  });

  it("reason zorunlu", () => {
    assert.throws(() => validateRefundReason("ab"), PaymentRefundValidationError);
  });

  it("güvenli state transition", () => {
    assert.doesNotThrow(() => assertRefundStateTransition("PAID", "PARTIALLY_REFUNDED"));
    assert.doesNotThrow(() => assertRefundStateTransition("PARTIALLY_REFUNDED", "REFUNDED"));
    assert.throws(() => assertRefundStateTransition("REFUNDED", "PAID"));
  });
});

describe("provider response redaction", () => {
  it("hassas alanları response dışında bırakır", () => {
    const redacted = redactProviderRefundResponse({
      status: "success",
      merchant_key: "secret-key",
      card_mask: "411111******1111",
      err_no: "0",
    });
    assert.ok(redacted);
    assert.equal(redacted!.status, "success");
    assert.equal((redacted as Record<string, unknown>).merchant_key, undefined);
    assert.equal((redacted as Record<string, unknown>).card_mask, undefined);
  });
});

describe("refund service wiring", () => {
  it("servis audit ve cache invalidation çağırır", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const source = readFileSync(join(webRoot, "lib/payments/payment-refund-service.ts"), "utf8");
    assert.ok(source.includes("logAdminPaymentAudit"));
    assert.ok(source.includes("PAYMENT_REFUND_REQUESTED"));
    assert.ok(source.includes("PAYMENT_REFUND_COMPLETED"));
    assert.ok(source.includes("PAYMENT_REFUND_FAILED"));
    assert.ok(source.includes("invalidateAdminPaymentCaches"));
    assert.ok(source.includes("redactProviderRefundResponse"));
    assert.ok(!source.includes("providerResponse: result.raw"));
  });
});
