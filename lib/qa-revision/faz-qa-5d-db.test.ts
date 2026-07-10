/**
 * QA Faz 5D — DB entegrasyon testleri
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildCanonicalPlanDisplay } from "@/lib/billing/canonical-plan-display";
import { resolveSaleCustomerDisplay } from "@/lib/orders/sale-customer-display";
import { posCheckoutSchema } from "@/lib/pos-checkout-utils";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_TARGET_CONFIGURED =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");

describe("QA Faz 5D — DB integration", () => {
  let db: PrismaClient | null = null;
  let dbReady = false;
  let companyAId = "";
  let companyBId = "";
  let ownerId = "";
  const stamp = `qa5d-${Date.now()}`;

  before(async () => {
    if (!DB_TARGET_CONFIGURED) return;

    try {
      const { PrismaClient } = await import("@prisma/client");
      db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
      await db.$connect();
      dbReady = true;

      const { hashPassword } = await import("@/lib/auth");
      const hash = await hashPassword("TestPass123!");

      const owner = await db.user.create({
        data: {
          email: `${stamp}@qa.internal`,
          password: hash,
          name: "QA 5D Owner",
          role: "OWNER",
          status: "ACTIVE",
          sessionVersion: 1,
          loginTrackingStatus: "NEVER_LOGGED_IN",
        },
      });
      ownerId = owner.id;

      const companyA = await db.company.create({
        data: { name: `QA5D_A_${stamp}`, status: "ACTIVE" },
      });
      companyAId = companyA.id;

      const companyB = await db.company.create({
        data: { name: `QA5D_B_${stamp}`, status: "ACTIVE" },
      });
      companyBId = companyB.id;

      await db.companyUser.createMany({
        data: [
          {
            userId: ownerId,
            companyId: companyAId,
            role: "OWNER",
            status: "ACTIVE",
            isOwner: true,
          },
          {
            userId: ownerId,
            companyId: companyBId,
            role: "OWNER",
            status: "ACTIVE",
            isOwner: true,
          },
        ],
      });
    } catch {
      dbReady = false;
    }
  });

  after(async () => {
    if (!db || !dbReady) return;

    await db.saleItem.deleteMany({
      where: { sale: { companyId: { in: [companyAId, companyBId] } } },
    });
    await db.sale.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.customer.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.companyUser.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await db.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    await db.$disconnect();
  });

  it("aktif plan canonical fiyat ve 14 günlük trial platform ayarından gelir", async (t) => {
    if (!dbReady || !db) {
      t.skip("TEST_DATABASE_URL yok veya bağlantı kurulamadı");
      return;
    }

    const plan = await db.membershipPlan.findFirst({
      where: { planStatus: "ACTIVE", isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!plan) {
      t.skip("Aktif plan yok");
      return;
    }

    const display = await buildCanonicalPlanDisplay({
      plan,
      platformTrialDays: 14,
    });
    assert.ok(display);
    if (plan.trialEnabled) {
      assert.equal(display!.trialDays, 14);
    }
    assert.ok(display!.monthlyPrice > 0);
  });

  it("TEST plan adı public canonical display'de filtrelenir", async (t) => {
    if (!dbReady || !db) {
      t.skip("TEST_DATABASE_URL yok");
      return;
    }

    const display = await buildCanonicalPlanDisplay({
      plan: {
        id: "virtual",
        code: "TEST",
        name: "ANA PAKET TEST",
        currency: "TRY",
        planStatus: "ACTIVE",
        trialEnabled: true,
        trialDays: 14,
      },
      platformTrialDays: 14,
    });
    assert.equal(display, null);
  });

  it("marketplace siparişi tenant izolasyonu", async (t) => {
    if (!dbReady || !db) {
      t.skip("TEST_DATABASE_URL yok");
      return;
    }

    const customerA = await db.customer.create({
      data: {
        companyId: companyAId,
        name: "Trendyol Müşterileri",
        group: "Pazaryeri",
        status: "ACTIVE",
      },
    });

    const saleA = await db.sale.create({
      data: {
        companyId: companyAId,
        customerId: customerA.id,
        saleNo: `QA5D-${stamp}-A`,
        subtotal: 100,
        vatTotal: 20,
        discount: 0,
        total: 120,
        status: "COMPLETED",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        sourceChannel: "TRENDYOL",
        externalOrderId: `EXT-${stamp}`,
        orderStatus: "WAITING",
        orderNote: "Alıcı: QA Tenant A Buyer.",
        items: {
          create: {
            name: "Ürün",
            quantity: 1,
            unitPrice: 100,
            vatRate: 20,
            total: 100,
          },
        },
      },
      include: { customer: true },
    });

    const saleB = await db.sale.findFirst({
      where: { companyId: companyBId, externalOrderId: `EXT-${stamp}` },
    });
    assert.equal(saleB, null);

    const display = resolveSaleCustomerDisplay({
      sourceChannel: saleA.sourceChannel,
      externalOrderId: saleA.externalOrderId,
      orderNote: saleA.orderNote,
      customer: saleA.customer,
    });
    assert.equal(display.customerName, "QA Tenant A Buyer");
    assert.notEqual(display.customerName, "Müşteri seçilmedi");
  });

  it("boş POS checkout payload reddedilir", () => {
    const parsed = posCheckoutSchema.safeParse({
      idempotencyKey: "a".repeat(16),
      items: [],
      payments: [],
    });
    assert.equal(parsed.success, false);
  });
});
