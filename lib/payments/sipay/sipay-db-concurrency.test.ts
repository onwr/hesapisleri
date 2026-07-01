/**
 * Sipay Faz 1.2 — finalize/refund concurrency (hesapisleri_test)
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { CheckoutProvider } from "@/lib/payments/checkout-provider";
import { db } from "@/lib/prisma";
import {
  finalizeSipayPayment,
  _setSipayProviderFactoryForTests,
  _resetSipayProviderFactoryForTests,
} from "./sipay-checkout-service";
import { refundSipayPayment } from "./sipay-refund";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");

function paidProvider(invoiceId: string, amountMinor: number): CheckoutProvider {
  return {
    provider: "SIPAY",
    async createCheckout() {
      throw new Error("not used");
    },
    async checkStatus() {
      return {
        invoiceId,
        status: "PAID",
        amountMinor,
        currency: "TRY",
        providerPaymentId: "provider-txn-001",
      };
    },
    verifyReturn() {
      return { invoiceId, valid: true };
    },
    verifyWebhook() {
      return { invoiceId, status: "PAID" };
    },
    async refund(input) {
      return { referenceNo: input.referenceNo, status: "SUCCEEDED" };
    },
  };
}

describe("Sipay — concurrency DB", { skip: DB_AVAILABLE ? false : "SKIP: hesapisleri_test required" }, () => {
  let companyId: string;
  let userId: string;
  let planId: string;
  const ts = Date.now();

  before(async () => {
    const { hashPassword } = await import("@/lib/auth");
    const user = await db.user.create({
      data: {
        email: `sipay-race-${ts}@test.internal`,
        password: await hashPassword("Test123!"),
        name: "Race Test",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    userId = user.id;

    const company = await db.company.create({
      data: { name: `SipayRace_${ts}`, status: "ACTIVE" },
    });
    companyId = company.id;

    await db.companyUser.create({
      data: { userId, companyId, role: "OWNER", status: "ACTIVE", isOwner: true },
    });

    const plan = await db.membershipPlan.findFirst({ where: { planStatus: "ACTIVE" } });
    if (!plan) throw new Error("Active membership plan required in test DB");
    planId = plan.id;

    await db.companySubscription.upsert({
      where: { companyId },
      create: {
        companyId,
        planId,
        status: "EXPIRED",
        currentPeriodStart: new Date("2020-01-01"),
        currentPeriodEnd: new Date("2020-02-01"),
      },
      update: { planId, status: "EXPIRED" },
    });
  });

  after(async () => {
    _resetSipayProviderFactoryForTests();
    await db.paymentRefund.deleteMany({ where: { companyId } });
    await db.membershipPayment.deleteMany({ where: { companyId } });
    await db.paymentAttempt.deleteMany({ where: { companyId } });
    await db.billingOutboxEvent.deleteMany({ where: { companyId } });
    await db.activityLog.deleteMany({ where: { companyId } });
    await db.companySubscription.deleteMany({ where: { companyId } });
    await db.companyUser.deleteMany({ where: { companyId } });
    await db.company.delete({ where: { id: companyId } });
    await db.user.delete({ where: { id: userId } });
  });

  async function seedAttempt(invoiceId: string, amountMinor = 9990) {
    const periodStart = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.paymentAttempt.create({
      data: {
        companyId,
        userId,
        idempotencyKey: `race-${invoiceId}`,
        payloadHash: `ph-${invoiceId}`,
        provider: "SIPAY",
        status: "PENDING",
        invoiceId,
        amountMinor,
        currency: "TRY",
        planId,
        testMode: true,
        priceSnapshot: {
          billingPeriodSnapshot: "MONTHLY",
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          subtotalMinor: amountMinor,
          vatMinor: 0,
          totalMinor: amountMinor,
          isRenewal: false,
        },
      },
    });
  }

  it("parallel finalize → tek MembershipPayment", async () => {
    const invoiceId = `SI-RACE-FIN-${ts}`;
    await seedAttempt(invoiceId);
    _setSipayProviderFactoryForTests(() => paidProvider(invoiceId, 9990));

    const [a, b] = await Promise.all([
      finalizeSipayPayment(invoiceId, "return"),
      finalizeSipayPayment(invoiceId, "webhook"),
    ]);

    const payments = await db.membershipPayment.findMany({ where: { merchantOid: invoiceId } });
    const attempt = await db.paymentAttempt.findUnique({ where: { invoiceId } });
    const outbox = await db.billingOutboxEvent.findMany({
      where: { companyId, type: "PAYMENT_SUCCEEDED" },
    });

    assert.equal(payments.length, 1);
    assert.equal(attempt?.status, "COMPLETED");
    assert.ok(a.membershipPaymentId || a.duplicate || b.membershipPaymentId || b.duplicate);
    assert.ok(outbox.length <= 1);
  });

  it("refund idempotency key replay", async () => {
    const invoiceId = `SI-RACE-REF-${ts}`;
    await seedAttempt(invoiceId, 5000);
    _setSipayProviderFactoryForTests(() => paidProvider(invoiceId, 5000));
    await finalizeSipayPayment(invoiceId, "return");

    const ref = `REF-${ts}`;
    const first = await refundSipayPayment({
      invoiceId,
      referenceNo: ref,
      amountMinor: 2000,
      initiatedByUserId: userId,
    });
    const second = await refundSipayPayment({
      invoiceId,
      referenceNo: ref,
      amountMinor: 2000,
      initiatedByUserId: userId,
    });

    const refunds = await db.paymentRefund.findMany({ where: { referenceNo: ref } });
    assert.equal(first.status, "SUCCEEDED");
    assert.equal(second.status, "SUCCEEDED");
    assert.equal(refunds.length, 1);
  });

  it("over-refund reddedilir", async () => {
    const invoiceId = `SI-RACE-OVER-${ts}`;
    await seedAttempt(invoiceId, 3000);
    _setSipayProviderFactoryForTests(() => paidProvider(invoiceId, 3000));
    await finalizeSipayPayment(invoiceId, "return");

    await assert.rejects(
      () =>
        refundSipayPayment({
          invoiceId,
          referenceNo: `REF-OVER-${ts}`,
          amountMinor: 5000,
          initiatedByUserId: userId,
        }),
      /aşamaz/,
    );
  });
});
