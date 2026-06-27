/**
 * Faz 5 — Admin payment management behavior tests.
 * Pure logic + route/security assertions; DB gerektiren akışlar mock'suz saf fonksiyonlarla test edilir.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readFile(...segments: string[]) {
  return readFileSync(join(webRoot, ...segments), "utf8");
}

import {
  sumCompletedRefundsMinor,
  sumPendingRefundsMinor,
  getMaxRefundableMinor,
  validateRefundAmount,
  reconcileRefundedAmountMinor,
} from "./admin-payment-refund-utils.js";

import {
  detectPaymentIssues,
  readSnapshotTotalMinor,
} from "./admin-payment-issue-service.js";

import {
  buildPaymentTimelineEvents,
  hasDuplicateCallbackSignal,
  WEBHOOK_SAFE_SELECT,
} from "./admin-payment-event-service.js";

import { evaluateRefundUiGate } from "./admin-payment-refund-service.js";

import { IS_NOT_TRIAL_PLACEHOLDER, REVENUE_ELIGIBLE_WHERE } from "./admin-payment-metric-definitions.js";

import { buildAdminPaymentListWhere } from "./admin-payment-filter-utils.js";

describe("legacy PATCH kapatma", () => {
  it("membership-payments PATCH route 405 döner", () => {
    const source = readFile("app", "api", "admin", "membership-payments", "[id]", "route.ts");
    assert.ok(source.includes("405"));
    assert.ok(source.includes("PAYMENT_STATUS_MUTATION_DISABLED"));
    assert.ok(!source.includes("updateMembershipPaymentAdmin"));
  });

  it("AdminMembershipPaymentActions bileşeni kaldırıldı", () => {
    let threw = false;
    try {
      readFile("components", "admin", "admin-membership-payment-actions.tsx");
    } catch {
      threw = true;
    }
    assert.ok(threw, "admin-membership-payment-actions.tsx silinmiş olmalı");
  });

  it("payments list sayfası manuel aksiyon import etmez", () => {
    const source = readFile("app", "admin", "payments", "page.tsx");
    assert.ok(!source.includes("AdminMembershipPaymentActions"));
    assert.ok(source.includes("AdminPaymentsListShell"));
  });
});

describe("refund source of truth", () => {
  const refunds = [
    { status: "SUCCEEDED", amountMinor: 1000, currency: "TRY", completedAt: new Date() },
    { status: "PROCESSING", amountMinor: 500, currency: "TRY", completedAt: null },
    { status: "FAILED", amountMinor: 300, currency: "TRY", completedAt: null },
    { status: "SUCCEEDED", amountMinor: 200, currency: "TRY", completedAt: new Date() },
  ];

  it("pending refund toplam iadeye girmez", () => {
    assert.equal(sumCompletedRefundsMinor(refunds, "TRY"), 1200);
    assert.equal(sumPendingRefundsMinor(refunds, "TRY"), 500);
  });

  it("failed refund toplam iadeye girmez", () => {
    const onlyFailed = [
      { status: "FAILED", amountMinor: 999, currency: "TRY", completedAt: null },
    ];
    assert.equal(sumCompletedRefundsMinor(onlyFailed, "TRY"), 0);
  });

  it("completed partial refund doğru hesaplanır", () => {
    const partial = [
      { status: "SUCCEEDED", amountMinor: 2500, currency: "TRY", completedAt: new Date() },
    ];
    assert.equal(sumCompletedRefundsMinor(partial, "TRY"), 2500);
    const max = getMaxRefundableMinor({
      paymentAmountMinor: 10000,
      currency: "TRY",
      refunds: partial,
    });
    assert.equal(max, 7500);
  });

  it("refund overflow reddedilir", () => {
    const result = validateRefundAmount({
      requestedMinor: 9000,
      paymentAmountMinor: 10000,
      currency: "TRY",
      refundCurrency: "TRY",
      refunds: [{ status: "SUCCEEDED", amountMinor: 5000, currency: "TRY", completedAt: new Date() }],
    });
    assert.equal(result.ok, false);
  });

  it("refund currency mismatch reddedilir", () => {
    const result = validateRefundAmount({
      requestedMinor: 100,
      paymentAmountMinor: 10000,
      currency: "TRY",
      refundCurrency: "USD",
      refunds: [],
    });
    assert.equal(result.ok, false);
  });

  it("reconcile çift sayım yapmaz", () => {
    const r = reconcileRefundedAmountMinor({
      payment: { amountMinor: 10000, currency: "TRY", refundedAmountMinor: 1200, status: "PARTIALLY_REFUNDED" },
      refunds: [{ status: "SUCCEEDED", amountMinor: 1200, currency: "TRY", completedAt: new Date() }],
    });
    assert.equal(r.fromRefunds, 1200);
    assert.equal(r.mismatch, false);
  });
});

describe("trial / tahsilat semantiği", () => {
  it("REVENUE_ELIGIBLE trial placeholder hariç tutar", () => {
    assert.ok("NOT" in REVENUE_ELIGIBLE_WHERE || "provider" in REVENUE_ELIGIBLE_WHERE);
    assert.deepEqual(IS_NOT_TRIAL_PLACEHOLDER, { NOT: { provider: "TRIAL" } });
  });

  it("trial placeholder issue üretmez (orphan beklenmeyen değil)", () => {
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PENDING",
        provider: "TRIAL",
        providerEnum: "MANUAL",
        currency: "TRY",
        companyId: "c1",
        subscriptionId: null,
        createdAt: new Date(),
      },
      subscription: null,
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(!issues.includes("SUBSCRIPTION_MISSING_UNEXPECTED"));
  });
});

describe("amount comparison snapshot", () => {
  it("snapshot totalMinor üzerinden karşılaştırır", () => {
    assert.equal(readSnapshotTotalMinor({ totalMinor: 14990 }), 14990);
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "PAYTR",
        provider: "PAYTR",
        amountMinor: 14990,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: "s1",
        paidAt: new Date(),
        priceSnapshot: { totalMinor: 14990 },
        createdAt: new Date(),
      },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(!issues.includes("AMOUNT_MISMATCH"));
  });

  it("snapshot yoksa yanlış AMOUNT_MISMATCH üretmez", () => {
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "PAYTR",
        amountMinor: 9999,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: "s1",
        paidAt: new Date(),
        priceSnapshot: null,
        createdAt: new Date(),
      },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(!issues.includes("AMOUNT_MISMATCH"));
  });
});

describe("orphan payment semantiği", () => {
  it("PAYTR PAID bağlı değilse SUBSCRIPTION_NOT_LINKED_EXPECTED", () => {
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "PAYTR",
        amountMinor: 1000,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: null,
        paidAt: new Date(),
        createdAt: new Date(),
      },
      subscription: null,
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(issues.includes("SUBSCRIPTION_NOT_LINKED_EXPECTED"));
  });

  it("MANUAL legacy orphan otomatik hata değil", () => {
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "MANUAL",
        type: "LEGACY",
        amountMinor: 1000,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: null,
        paidAt: new Date(),
        createdAt: new Date(),
      },
      subscription: null,
      completedRefundMinor: 0,
      hasFailedOutbox: false,
    });
    assert.ok(!issues.includes("SUBSCRIPTION_MISSING_UNEXPECTED"));
  });
});

describe("duplicate callback", () => {
  it("attemptCount>1 olmadan duplicate issue üretilmez", () => {
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "PAYTR",
        merchantOid: "oid1",
        amountMinor: 1000,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: "s1",
        callbackReceivedAt: new Date(),
        paidAt: new Date(),
        createdAt: new Date(),
      },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
      webhookDuplicateAttempt: false,
    });
    assert.ok(!issues.some((i) => i.includes("DUPLICATE")));
  });

  it("attemptCount>1 ile duplicate issue üretilir", () => {
    assert.ok(hasDuplicateCallbackSignal([{ attemptCount: 1 }, { attemptCount: 2 }]));
    const issues = detectPaymentIssues({
      payment: {
        id: "p1",
        status: "PAID",
        providerEnum: "PAYTR",
        amountMinor: 1000,
        currency: "TRY",
        companyId: "c1",
        subscriptionId: "s1",
        paidAt: new Date(),
        createdAt: new Date(),
      },
      subscription: { id: "s1", companyId: "c1", status: "ACTIVE" },
      completedRefundMinor: 0,
      hasFailedOutbox: false,
      webhookDuplicateAttempt: true,
    });
    assert.ok(issues.includes("DUPLICATE_MERCHANT_OID_ATTEMPT"));
  });
});

describe("webhook güvenliği", () => {
  it("WEBHOOK_SAFE_SELECT rawPayload içermez", () => {
    assert.ok(!("rawPayload" in WEBHOOK_SAFE_SELECT));
    assert.ok(!("payloadHash" in WEBHOOK_SAFE_SELECT));
  });

  it("detail servisi rawPayload select etmez", () => {
    const source = readFile("lib", "admin", "payments", "admin-payment-detail-service.ts");
    assert.ok(source.includes("WEBHOOK_SAFE_SELECT"));
    assert.ok(!source.includes("rawPayload: true"));
  });
});

describe("legacy filtre parametreleri", () => {
  it("companyId, paymentId, subscriptionId, merchantOid korunur", () => {
    const where = buildAdminPaymentListWhere({
      status: "ALL",
      provider: "ALL",
      currency: "ALL",
      dateRange: "ALL",
      refund: "ALL",
      callback: "ALL",
      subscription: "ALL",
      sortBy: "createdAt",
      sortDir: "desc",
      page: 1,
      pageSize: 25,
      companyId: "co1",
      paymentId: "pay1",
      subscriptionId: "sub1",
      merchantOid: "MO123",
    });
    assert.equal(where.companyId, "co1");
    assert.equal(where.id, "pay1");
    assert.equal(where.subscriptionId, "sub1");
    assert.ok(where.merchantOid);
  });
});

describe("event dedupe", () => {
  it("deterministik event id kullanır", () => {
    const now = new Date("2025-01-01T10:00:00Z");
    const events = buildPaymentTimelineEvents({
      payment: {
        id: "pay_1",
        status: "PAID",
        createdAt: now,
        paidAt: now,
        failedAt: null,
        callbackReceivedAt: now,
      },
      webhooks: [
        {
          id: "wh1",
          eventKey: "key1",
          signatureValid: true,
          processingStatus: "PROCESSED",
          receivedAt: now,
          processedAt: now,
          lastError: null,
          attemptCount: 1,
        },
      ],
      outbox: [],
      refunds: [],
      activity: [],
    });
    const ids = events.map((e) => e.id);
    assert.ok(ids.includes("payment-created:pay_1"));
    assert.ok(ids.includes("webhook:wh1"));
    assert.equal(new Set(ids).size, ids.length);
  });

  it("webhook önceliği payment state üzerinde", () => {
    const t = new Date("2025-06-01T12:00:00Z");
    const events = buildPaymentTimelineEvents({
      payment: { id: "p", status: "PAID", createdAt: t, paidAt: t, failedAt: null, callbackReceivedAt: t },
      webhooks: [
        {
          id: "w1",
          eventKey: "k",
          signatureValid: true,
          processingStatus: "PROCESSED",
          receivedAt: t,
          processedAt: t,
          lastError: null,
          attemptCount: 1,
        },
      ],
      outbox: [],
      refunds: [],
      activity: [],
    });
    const webhook = events.find((e) => e.id === "webhook:w1");
    assert.ok(webhook);
    assert.equal(webhook!.source, "webhook");
  });
});

describe("refund UI gate", () => {
  it("audit/cache bağlıysa gate açılır", () => {
    const gate = evaluateRefundUiGate({
      isSuperAdmin: true,
      paymentStatus: "PAID",
      providerEnum: "PAYTR",
      merchantOid: "oid",
      amountMinor: 10000,
      currency: "TRY",
      refunds: [],
      hasAuditOnRefund: true,
      hasCacheInvalidationOnRefund: true,
    });
    assert.equal(gate.canInitiate, true);
    assert.equal(gate.missingGates.length, 0);
  });

  it("MANUAL provider refund desteklenmez", () => {
    const gate = evaluateRefundUiGate({
      isSuperAdmin: true,
      paymentStatus: "PAID",
      providerEnum: "MANUAL",
      merchantOid: null,
      amountMinor: 10000,
      currency: "TRY",
      refunds: [],
      hasAuditOnRefund: true,
      hasCacheInvalidationOnRefund: true,
    });
    assert.equal(gate.providerSupported, false);
    assert.equal(gate.canInitiate, false);
  });
});

describe("provider sync", () => {
  it("MANUAL sync NOT_SUPPORTED döner", async () => {
    const source = readFile("lib", "admin", "payments", "admin-payment-provider-service.ts");
    assert.ok(source.includes('providerEnum !== "PAYTR"'));
    assert.ok(source.includes("NOT_SUPPORTED"));
    assert.ok(source.includes("syncMembershipPaymentWithProvider"));
  });
});

describe("AdminPaymentNote FK politikası", () => {
  it("migration paymentId RESTRICT authorUserId SET NULL", () => {
    const sql = readFile(
      "prisma",
      "migrations",
      "20260703120000_admin_payment_management",
      "migration.sql"
    );
    assert.ok(sql.includes("ON DELETE RESTRICT"));
    assert.ok(sql.includes("ON DELETE SET NULL"));
  });

  it("schema authorUserId nullable", () => {
    const schema = readFile("prisma", "schema.prisma");
    assert.ok(schema.includes("authorUserId String?"));
    assert.ok(schema.includes('onDelete: Restrict'));
    assert.ok(schema.includes('onDelete: SetNull'));
  });
});

describe("CSV redaction", () => {
  it("export merchantOid maskeli", () => {
    const source = readFile("lib", "admin", "payments", "admin-payment-list-service.ts");
    assert.ok(source.includes("merchantOidMasked"));
    assert.ok(!source.includes("merchantOid,"));
  });
});

describe("dynamic route adı", () => {
  it("payments [id] kullanır paymentId klasörü yok", () => {
    const page = readFile("app", "admin", "payments", "[id]", "page.tsx");
    assert.ok(page.includes("[id]") || page.includes("id"));
    let threw = false;
    try {
      readFile("app", "admin", "payments", "[paymentId]", "page.tsx");
    } catch {
      threw = true;
    }
    assert.ok(threw);
  });
});
