/**
 * Sipay finalize güvenlik ve doğrulama testleri (DB gerektirmez).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  assertCheckStatusMatchesAttempt,
  assertPaymentAttemptSnapshotConsistency,
  buildPaymentAttemptVerificationTarget,
} from "./sipay-verification";

const ATTEMPT = {
  invoiceId: "SI-SEC-001",
  amountMinor: 9990,
  currency: "TRY",
  companyId: "company-a",
  planId: "plan-1",
  planPriceId: "price-1",
  priceSnapshot: {
    planId: "plan-1",
    planPriceId: "price-1",
    totalMinor: 9990,
    currency: "TRY",
    billingPeriodSnapshot: "MONTHLY",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-02-01T00:00:00.000Z",
  },
};

describe("sipay-verification — checkstatus eşleşmesi", () => {
  it("PAID checkstatus invoice/amount/currency eşleşince geçer", () => {
    const target = buildPaymentAttemptVerificationTarget(ATTEMPT);
    assert.doesNotThrow(() =>
      assertCheckStatusMatchesAttempt(target, {
        invoiceId: "SI-SEC-001",
        status: "PAID",
        amountMinor: 9990,
        currency: "TRY",
        providerPaymentId: "txn-1",
      }),
    );
  });

  it("tutar uyuşmazlığında finalize edilmez", () => {
    const target = buildPaymentAttemptVerificationTarget(ATTEMPT);
    assert.throws(
      () =>
        assertCheckStatusMatchesAttempt(target, {
          invoiceId: "SI-SEC-001",
          status: "PAID",
          amountMinor: 1,
          currency: "TRY",
        }),
      /tutar uyuşmazlığı/,
    );
  });

  it("invoice uyuşmazlığında finalize edilmez", () => {
    const target = buildPaymentAttemptVerificationTarget(ATTEMPT);
    assert.throws(
      () =>
        assertCheckStatusMatchesAttempt(target, {
          invoiceId: "SI-OTHER",
          status: "PAID",
          amountMinor: 9990,
          currency: "TRY",
        }),
      /invoice uyuşmazlığı/,
    );
  });

  it("planId snapshot ile attempt planId eşleşmeli", () => {
    assert.throws(
      () =>
        assertPaymentAttemptSnapshotConsistency(
          buildPaymentAttemptVerificationTarget({
            ...ATTEMPT,
            planId: "plan-a",
            priceSnapshot: { ...ATTEMPT.priceSnapshot, planId: "plan-b" },
          }),
        ),
      /planId snapshot uyuşmazlığı/,
    );
  });

  it("planId yalnız snapshot'tan çözülebilir (arşivlenmiş plan senaryosu)", () => {
    assert.doesNotThrow(() =>
      assertPaymentAttemptSnapshotConsistency(
        buildPaymentAttemptVerificationTarget({
          ...ATTEMPT,
          planId: null,
          priceSnapshot: { ...ATTEMPT.priceSnapshot, planId: "archived-plan-id" },
        }),
      ),
    );
  });
});

describe("sipay-finalize-security — kaynak denetimleri", () => {
  it("finalize route login + origin + rate limit içerir", async () => {
    const src = await fs.readFile("app/api/billing/sipay/finalize/route.ts", "utf8");
    assert.match(src, /getAppSession/);
    assert.match(src, /canManageMembership/);
    assert.match(src, /verifyApiMutationOrigin/);
    assert.match(src, /checkRateLimitAsync/);
    assert.match(src, /companyId: session\.company\.id/);
    assert.match(src, /finalizeSipayPayment\(/);
    assert.match(src, /companyId: session\.company\.id/);
  });

  it("finalizeSipayPayment callback sırasında getDefaultMembershipPlan çağırmaz", async () => {
    const src = await fs.readFile("lib/payments/sipay/sipay-checkout-service.ts", "utf8");
    const finalizeStart = src.indexOf("export async function finalizeSipayPayment");
    const finalizeBody = src.slice(finalizeStart, src.indexOf("export async function markSipayVerificationPending"));
    assert.ok(!finalizeBody.includes("getDefaultMembershipPlan"));
    assert.ok(!finalizeBody.includes("standard"));
    assert.ok(!finalizeBody.includes("standart"));
    assert.ok(finalizeBody.includes("attempt.planId"));
    assert.ok(finalizeBody.includes("priceSnapshot.planId"));
  });

  it("return callback hash geçersiz olsa da doğrudan başarı saymaz — checkstatus çağrılır", async () => {
    const src = await fs.readFile("lib/payments/sipay/sipay-callback-handlers.ts", "utf8");
    assert.match(src, /hash missing or invalid; continuing with checkstatus/);
    assert.match(src, /finalizeSipayPayment\(invoiceId, "return"\)/);
    assert.doesNotMatch(src, /invalid_hash/);
  });

  it("return redirect POST=303 GET=302 kullanır", async () => {
    const src = await fs.readFile("lib/payments/sipay/sipay-callback-handlers.ts", "utf8");
    assert.match(src, /request\.method === "POST" \? 303 : 302/);
    assert.match(src, /outcome: "success"/);
    assert.match(src, /outcome: "pending"/);
    assert.match(src, /outcome: "failed"/);
  });

  it("sonuç sayfası poller sınırlı deneme yapar", async () => {
    const src = await fs.readFile("components/billing/sipay-result-poller.tsx", "utf8");
    assert.match(src, /MAX_POLLS = 15/);
    assert.match(src, /pollCount < MAX_POLLS/);
  });

  it("sonuç sayfası yalnız şirkete ait attempt bulunca poll eder", async () => {
    const page = await fs.readFile("app/settings/billing/payment/sipay-result/page.tsx", "utf8");
    assert.match(page, /getSipayPaymentResultForCompany\(session\.company\.id/);
    assert.match(page, /shouldPoll && result\.found/);
  });

  it("loglarda hash_key veya kart verisi yazılmaz", async () => {
    const callback = await fs.readFile("lib/payments/sipay/sipay-callback-handlers.ts", "utf8");
    const consoleLines = callback
      .split("\n")
      .filter((line) => /console\.(log|info|warn|error)/.test(line));
    for (const line of consoleLines) {
      assert.ok(!line.includes("hash_key"), `log satırı hash_key içeriyor: ${line}`);
      assert.ok(!line.includes("merchant_key"), `log satırı merchant_key içeriyor: ${line}`);
      assert.ok(!line.includes("app_secret"), `log satırı app_secret içeriyor: ${line}`);
    }
    const env = await fs.readFile("lib/payments/sipay/sipay-env.ts", "utf8");
    assert.ok(env.includes("maskCredentialPreview"));
  });
});

describe("sipay-provider — status_code 69 PENDING", () => {
  it("mapCheckStatusResult 69 için PENDING döner", async () => {
    const src = await fs.readFile("lib/payments/sipay/sipay-provider.ts", "utf8");
    assert.match(src, /statusCode === 69\) return "PENDING"/);
  });
});
