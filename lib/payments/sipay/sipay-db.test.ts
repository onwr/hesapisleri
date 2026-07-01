/**
 * Sipay Faz 1.1 — PaymentAttempt DB entegrasyon testleri (hesapisleri_test)
 *
 * TEST_DATABASE_URL=postgresql://postgres:pass@127.0.0.1:5432/hesapisleri_test \
 *   npm run test:db-integration
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: Sipay DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("Sipay — PaymentAttempt DB entegrasyonu", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let userId: string;
  const ts = Date.now();

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("Test123!");

    const user = await db.user.create({
      data: {
        email: `sipay-test-${ts}@sipay-db.internal`,
        password: hash,
        name: "Sipay Test",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    userId = user.id;

    const cA = await db.company.create({ data: { name: `SipayDB_A_${ts}`, status: "ACTIVE" } });
    companyAId = cA.id;
    const cB = await db.company.create({ data: { name: `SipayDB_B_${ts}`, status: "ACTIVE" } });
    companyBId = cB.id;

    await db.companyUser.createMany({
      data: [
        { userId, companyId: companyAId, role: "OWNER", status: "ACTIVE", isOwner: true },
        { userId, companyId: companyBId, role: "OWNER", status: "ACTIVE", isOwner: true },
      ],
    });
  });

  after(async () => {
    // Temizlik — test verilerini sil (sadece test DB'de)
    await db.paymentAttempt.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.companyUser.deleteMany({ where: { userId } });
    await db.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  // ─── 1. PaymentAttempt oluşturma ─────────────────────────────────────────────

  it("PaymentAttempt CREATED durumunda oluşturulur", async () => {
    const invoiceId = `SI-DB-CREATE-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-create-${ts}`,
        payloadHash: "ph-create",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    assert.equal(attempt.status, "CREATED");
    assert.equal(attempt.invoiceId, invoiceId);
    assert.equal(attempt.companyId, companyAId);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 2. invoiceId unique kısıtı ──────────────────────────────────────────────

  it("Aynı invoiceId ile ikinci kayıt oluşturulamaz (unique)", async () => {
    const invoiceId = `SI-DB-UNIQ-${ts}`;
    await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-uniq-${ts}`,
        payloadHash: "ph-uniq",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    await assert.rejects(
      () =>
        db.paymentAttempt.create({
          data: {
            companyId: companyAId,
            userId,
            idempotencyKey: `idem-uniq2-${ts}`,
            payloadHash: "ph-uniq2",
            provider: "SIPAY",
            status: "CREATED",
            invoiceId, // AYNI invoiceId
            amountMinor: 9990,
            currency: "TRY",
            testMode: true,
          },
        }),
      /unique/i,
    );

    await db.paymentAttempt.deleteMany({ where: { invoiceId } });
  });

  // ─── 3. companyId + idempotencyKey unique kısıtı ─────────────────────────────

  it("Aynı companyId + idempotencyKey ile ikinci kayıt oluşturulamaz", async () => {
    const idempotencyKey = `idem-compound-${ts}`;
    await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey,
        payloadHash: "ph-compound",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId: `SI-DB-COMP1-${ts}`,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    await assert.rejects(
      () =>
        db.paymentAttempt.create({
          data: {
            companyId: companyAId, // AYNI company
            userId,
            idempotencyKey, // AYNI idempotencyKey
            payloadHash: "ph-compound2",
            provider: "SIPAY",
            status: "CREATED",
            invoiceId: `SI-DB-COMP2-${ts}`,
            amountMinor: 9990,
            currency: "TRY",
            testMode: true,
          },
        }),
      /unique/i,
    );

    await db.paymentAttempt.deleteMany({ where: { companyId: companyAId, idempotencyKey } });
  });

  // ─── 4. Farklı company'ler aynı idempotencyKey kullanabilir (tenant izolasyonu) ───

  it("Farklı firmalar aynı idempotencyKey kullanabilir", async () => {
    const idempotencyKey = `idem-tenant-${ts}`;
    const a = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey,
        payloadHash: "ph-tenant-a",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId: `SI-DB-TENA-${ts}`,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });
    const b = await db.paymentAttempt.create({
      data: {
        companyId: companyBId,
        userId,
        idempotencyKey,
        payloadHash: "ph-tenant-b",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId: `SI-DB-TENB-${ts}`,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    assert.notEqual(a.id, b.id);
    assert.equal(a.idempotencyKey, b.idempotencyKey);

    await db.paymentAttempt.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });

  // ─── 5. Durum geçişleri ───────────────────────────────────────────────────────

  it("CREATED → CHECKOUT_LINK_READY geçişi", async () => {
    const invoiceId = `SI-DB-TRANS1-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-trans1-${ts}`,
        payloadHash: "ph-trans1",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "CHECKOUT_LINK_READY", checkoutUrl: "https://provisioning.sipay.com.tr/pay/xyz" },
    });

    assert.equal(updated.status, "CHECKOUT_LINK_READY");
    assert.ok(updated.checkoutUrl);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  it("CHECKOUT_LINK_READY → COMPLETED geçişi", async () => {
    const invoiceId = `SI-DB-TRANS2-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-trans2-${ts}`,
        payloadHash: "ph-trans2",
        provider: "SIPAY",
        status: "CHECKOUT_LINK_READY",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
        checkoutUrl: "https://provisioning.sipay.com.tr/pay/xyz",
      },
    });

    const paidAt = new Date();
    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "COMPLETED", paidAt, providerStatus: "PAID" },
    });

    assert.equal(updated.status, "COMPLETED");
    assert.ok(updated.paidAt);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  it("CREATED → CANCELLED geçişi (vazgeçme)", async () => {
    const invoiceId = `SI-DB-CANCEL-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-cancel-${ts}`,
        payloadHash: "ph-cancel",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    assert.equal(updated.status, "CANCELLED");
    assert.ok(updated.cancelledAt);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 6. findUnique by invoiceId ───────────────────────────────────────────────

  it("invoiceId ile findUnique çalışır", async () => {
    const invoiceId = `SI-DB-FIND-${ts}`;
    await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-find-${ts}`,
        payloadHash: "ph-find",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    const found = await db.paymentAttempt.findUnique({ where: { invoiceId } });
    assert.ok(found);
    assert.equal(found.invoiceId, invoiceId);
    assert.equal(found.companyId, companyAId);

    await db.paymentAttempt.delete({ where: { id: found.id } });
  });

  // ─── 7. findUnique by companyId_idempotencyKey ────────────────────────────────

  it("companyId + idempotencyKey composite key ile lookup", async () => {
    const idempotencyKey = `idem-composite-${ts}`;
    const invoiceId = `SI-DB-COMP-FIND-${ts}`;
    await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey,
        payloadHash: "ph-composite-find",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    const found = await db.paymentAttempt.findUnique({
      where: { companyId_idempotencyKey: { companyId: companyAId, idempotencyKey } },
    });
    assert.ok(found);
    assert.equal(found.invoiceId, invoiceId);

    await db.paymentAttempt.delete({ where: { id: found.id } });
  });

  // ─── 8. Tenant izolasyonu: B şirketinden A'nın kaydı görünmez ────────────────

  it("Farklı tenant'ın invoiceId'si ile sorgu null döner", async () => {
    const invoiceId = `SI-DB-TENANT-ISO-${ts}`;
    await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-iso-${ts}`,
        payloadHash: "ph-iso",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    // companyB'nin bakış açısı: aynı idempotencyKey farklı company → yokmuş gibi
    const fromB = await db.paymentAttempt.findUnique({
      where: { companyId_idempotencyKey: { companyId: companyBId, idempotencyKey: `idem-iso-${ts}` } },
    });
    assert.equal(fromB, null);

    await db.paymentAttempt.deleteMany({ where: { invoiceId } });
  });

  // ─── 9. FAILED kayıt güncelleme (failedAt) ───────────────────────────────────

  it("FAILED duruma geçişte failedAt alanı set edilir", async () => {
    const invoiceId = `SI-DB-FAIL-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-fail-${ts}`,
        payloadHash: "ph-fail",
        provider: "SIPAY",
        status: "CHECKOUT_LINK_READY",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
        checkoutUrl: "https://provisioning.sipay.com.tr/pay/fail-test",
      },
    });

    const failedAt = new Date();
    const updated = await db.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "FAILED", failedAt, providerStatus: "NOT_PAID" },
    });

    assert.equal(updated.status, "FAILED");
    assert.ok(updated.failedAt);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 10. priceSnapshot JSON alanı depolanır ve geri çekilir ──────────────────

  it("priceSnapshot JSON alanı doğru depolanır", async () => {
    const invoiceId = `SI-DB-JSON-${ts}`;
    const priceSnapshot = {
      planId: "plan-xyz",
      planNameSnapshot: "Pro Plan",
      billingPeriodSnapshot: "MONTHLY",
      periodMonthsSnapshot: 1,
      subtotalMinor: 8475,
      vatRateSnapshot: 0.18,
      vatMinor: 1525,
      totalMinor: 10000,
      currency: "TRY",
      isRenewal: false,
      campaignIds: [],
    };

    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-json-${ts}`,
        payloadHash: "ph-json",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 10000,
        currency: "TRY",
        testMode: true,
        priceSnapshot,
      },
    });

    const found = await db.paymentAttempt.findUnique({ where: { id: attempt.id } });
    assert.ok(found?.priceSnapshot);
    const snap = found.priceSnapshot as typeof priceSnapshot;
    assert.equal(snap.planNameSnapshot, "Pro Plan");
    assert.equal(snap.totalMinor, 10000);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 11. providerPaymentId set edilir ────────────────────────────────────────

  it("providerPaymentId field'ı güncellenir", async () => {
    const invoiceId = `SI-DB-PPID-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-ppid-${ts}`,
        payloadHash: "ph-ppid",
        provider: "SIPAY",
        status: "COMPLETED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
        paidAt: new Date(),
        providerPaymentId: "sipay-txn-99001",
      },
    });

    assert.equal(attempt.providerPaymentId, "sipay-txn-99001");

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 12. payerEmail/payerIp gizlilik (null bırakılabilir) ────────────────────

  it("payerEmail ve payerIp opsiyoneldir (null OK)", async () => {
    const invoiceId = `SI-DB-NULL-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-null-${ts}`,
        payloadHash: "ph-null",
        provider: "SIPAY",
        status: "CREATED",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
        payerEmail: null,
        payerIp: null,
      },
    });

    assert.equal(attempt.payerEmail, null);
    assert.equal(attempt.payerIp, null);

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });

  // ─── 13. Çok sayıda attempt'i şirket bazlı listeleme ─────────────────────────

  it("companyId filtreli listede sadece o şirkete ait kayıtlar döner", async () => {
    const aInvoice = `SI-DB-LIST-A-${ts}`;
    const bInvoice = `SI-DB-LIST-B-${ts}`;

    await Promise.all([
      db.paymentAttempt.create({
        data: {
          companyId: companyAId,
          userId,
          idempotencyKey: `idem-list-a-${ts}`,
          payloadHash: "ph-list-a",
          provider: "SIPAY",
          status: "CREATED",
          invoiceId: aInvoice,
          amountMinor: 9990,
          currency: "TRY",
          testMode: true,
        },
      }),
      db.paymentAttempt.create({
        data: {
          companyId: companyBId,
          userId,
          idempotencyKey: `idem-list-b-${ts}`,
          payloadHash: "ph-list-b",
          provider: "SIPAY",
          status: "CREATED",
          invoiceId: bInvoice,
          amountMinor: 9990,
          currency: "TRY",
          testMode: true,
        },
      }),
    ]);

    const resultsA = await db.paymentAttempt.findMany({ where: { companyId: companyAId, invoiceId: { in: [aInvoice, bInvoice] } } });
    assert.equal(resultsA.length, 1);
    assert.equal(resultsA[0].invoiceId, aInvoice);

    await db.paymentAttempt.deleteMany({ where: { invoiceId: { in: [aInvoice, bInvoice] } } });
  });

  // ─── 14. Transaction içinde atomik güncelleme ─────────────────────────────────

  it("Transaction içinde atomik update: re-read + status check", async () => {
    const invoiceId = `SI-DB-TXN-${ts}`;
    const attempt = await db.paymentAttempt.create({
      data: {
        companyId: companyAId,
        userId,
        idempotencyKey: `idem-txn-${ts}`,
        payloadHash: "ph-txn",
        provider: "SIPAY",
        status: "PENDING",
        invoiceId,
        amountMinor: 9990,
        currency: "TRY",
        testMode: true,
      },
    });

    await db.$transaction(async (tx) => {
      const fresh = await tx.paymentAttempt.findUnique({ where: { invoiceId } });
      assert.ok(fresh);
      assert.equal(fresh.status, "PENDING"); // canFinalize
      await tx.paymentAttempt.update({
        where: { id: fresh.id },
        data: { status: "COMPLETED", paidAt: new Date() },
      });
    });

    const final = await db.paymentAttempt.findUnique({ where: { invoiceId } });
    assert.equal(final?.status, "COMPLETED");

    await db.paymentAttempt.delete({ where: { id: attempt.id } });
  });
});
