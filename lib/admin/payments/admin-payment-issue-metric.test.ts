/**
 * Issue service ve metrik politikası — pure davranış testleri.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPaymentIssues } from "./admin-payment-issue-service.js";
import { IS_NOT_TRIAL_PLACEHOLDER, REVENUE_ELIGIBLE_WHERE } from "./admin-payment-metric-definitions.js";
import { buildPaymentTimelineEvents } from "./admin-payment-event-service.js";

const now = new Date("2026-06-01T12:00:00Z");

function basePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    status: "PAID",
    providerEnum: "PAYTR",
    provider: "PAYTR",
    amountMinor: 10000,
    currency: "TRY",
    companyId: "c1",
    subscriptionId: "s1",
    paidAt: now,
    createdAt: now,
    merchantOid: "MO1",
    callbackReceivedAt: now,
    ...overrides,
  };
}

describe("issue service codes", () => {
  it("PENDING_TIMEOUT", () => {
    const old = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const issues = detectPaymentIssues({
      payment: { ...basePayment({ status: "PENDING", paidAt: null }), createdAt: old },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
      now,
    });
    assert.ok(issues.includes("PENDING_TIMEOUT"));
  });

  it("CALLBACK_MISSING", () => {
    const old = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const issues = detectPaymentIssues({
      payment: {
        ...basePayment({ callbackReceivedAt: null, status: "WAIT_CALLBACK" }),
        createdAt: old,
      },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
      now,
    });
    assert.ok(issues.includes("CALLBACK_MISSING"));
  });

  it("CALLBACK_INVALID", () => {
    const issues = detectPaymentIssues({
      payment: basePayment(),
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
      webhookInvalidSignature: true,
    });
    assert.ok(issues.includes("CALLBACK_INVALID"));
  });

  it("AMOUNT_MISMATCH yalnız snapshot ile", () => {
    const issues = detectPaymentIssues({
      payment: basePayment({ amountMinor: 9999, priceSnapshot: { totalMinor: 10000 } }),
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(issues.includes("AMOUNT_MISMATCH"));
  });

  it("snapshot yoksa AMOUNT_MISMATCH üretmez", () => {
    const issues = detectPaymentIssues({
      payment: basePayment({ priceSnapshot: null }),
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(!issues.includes("AMOUNT_MISMATCH"));
  });

  it("REFUND_OVERFLOW", () => {
    const issues = detectPaymentIssues({
      payment: basePayment(),
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 15000,
      hasFailedOutbox: false,
    });
    assert.ok(issues.includes("REFUND_OVERFLOW"));
  });

  it("SUBSCRIPTION_NOT_LINKED_EXPECTED", () => {
    const issues = detectPaymentIssues({
      payment: basePayment({ subscriptionId: null }),
      subscription: null,
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(issues.includes("SUBSCRIPTION_NOT_LINKED_EXPECTED"));
  });

  it("COMPANY_SUBSCRIPTION_MISMATCH", () => {
    const issues = detectPaymentIssues({
      payment: basePayment(),
      subscription: { id: "s1", companyId: "other", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(issues.includes("COMPANY_SUBSCRIPTION_MISMATCH"));
  });
});

describe("metric policy", () => {
  it("TRIAL legacy provider string ile hariç tutulur", () => {
    assert.deepEqual(IS_NOT_TRIAL_PLACEHOLDER, { NOT: { provider: "TRIAL" } });
    assert.equal(REVENUE_ELIGIBLE_WHERE.status, "PAID");
  });
});

describe("events dedupe priority", () => {
  it("aynı success olayı webhook önceliği ile tek kalır", () => {
    const t = new Date("2026-01-01T10:00:00Z");
    const events = buildPaymentTimelineEvents({
      payment: { id: "p1", status: "PAID", createdAt: t, paidAt: t, failedAt: null, callbackReceivedAt: t },
      webhooks: [{
        id: "w1", eventKey: "k1", signatureValid: true, processingStatus: "PROCESSED",
        receivedAt: t, processedAt: t, lastError: null, attemptCount: 1,
      }],
      outbox: [],
      refunds: [],
      activity: [{ id: "a1", action: "PAYMENT", message: "paid", createdAt: t }],
    });
    const webhook = events.find((e) => e.source === "webhook");
    const paymentPaid = events.find((e) => e.id === "payment-paid:p1");
    assert.ok(webhook);
    assert.ok(paymentPaid);
    assert.equal(new Set(events.map((e) => e.id)).size, events.length);
  });

  it("farklı olaylar timestamp yakın olsa da birleşmez", () => {
    const t1 = new Date("2026-01-01T10:00:00.000Z");
    const t2 = new Date("2026-01-01T10:00:00.001Z");
    const events = buildPaymentTimelineEvents({
      payment: { id: "p1", status: "PAID", createdAt: t1, paidAt: t2, failedAt: null, callbackReceivedAt: t2 },
      webhooks: [{
        id: "w1", eventKey: "k1", signatureValid: true, processingStatus: "PROCESSED",
        receivedAt: t1, processedAt: t2, lastError: null, attemptCount: 1,
      }],
      outbox: [{ id: "o1", type: "PAYMENT_SUCCEEDED", status: "PROCESSED", createdAt: t1, processedAt: t2, lastError: null }],
      refunds: [],
      activity: [],
    });
    assert.ok(events.some((e) => e.id === "webhook:w1"));
    assert.ok(events.some((e) => e.id === "outbox:o1"));
    assert.ok(events.some((e) => e.id === "payment-paid:p1"));
  });
});
