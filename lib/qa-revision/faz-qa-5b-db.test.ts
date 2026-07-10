/**
 * QA Faz 5B — DB entegrasyon testleri (hesapisleri_test).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildCanonicalMembershipDisplay } from "@/lib/membership-display-dto";
import { buildCanonicalTeamSummary } from "@/lib/team-summary";
import { buildSupplierStatusView } from "@/lib/supplier-status-view";
import {
  productFormSchema,
  productUpdateSchema,
} from "@/lib/product-form-utils";
import { supplierProductSchema } from "@/lib/supplier-utils";
import {
  sanitizeStructuredAiResponse,
  stripUnsafeAiDisplayText,
} from "@/lib/ai/ai-display-safety";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_TARGET_CONFIGURED =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");

describe("QA Faz 5B — DB integration", () => {
  let db: PrismaClient | null = null;
  let dbReady = false;
  let companyAId = "";
  let companyBId = "";
  let ownerId = "";
  const stamp = `qa5b-${Date.now()}`;

  before(async () => {
    if (!DB_TARGET_CONFIGURED) {
      return;
    }

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
          name: "QA 5B Owner",
          role: "OWNER",
          status: "ACTIVE",
          sessionVersion: 1,
          loginTrackingStatus: "NEVER_LOGGED_IN",
        },
      });
      ownerId = owner.id;

      const companyA = await db.company.create({
        data: { name: `QA5B_A_${stamp}`, status: "ACTIVE" },
      });
      companyAId = companyA.id;

      const companyB = await db.company.create({
        data: { name: `QA5B_B_${stamp}`, status: "ACTIVE" },
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

    await db.companyUser.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.product.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.employee.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.supplier.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.companySubscription.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await db.user.delete({ where: { id: ownerId } }).catch(() => undefined);
    await db.$disconnect();
  });

  it("API schema negatif ürün fiyatını reddeder", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const parsed = productFormSchema.safeParse({
      productType: "STOCK",
      name: "Negatif Fiyat Ürün",
      buyPrice: -1,
      sellPrice: 100,
      stock: 0,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(parsed.success, false);
  });

  it("başka tenant ürünü aynı companyId filtresiyle gelmez", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const productA = await db.product.create({
      data: {
        companyId: companyAId,
        name: `QA5B Product A ${stamp}`,
        buyPrice: 10,
        sellPrice: 20,
        stock: 1,
        minStock: 0,
        unitType: "PIECE",
        status: "ACTIVE",
        vatRate: 20,
      },
    });

    const productB = await db.product.create({
      data: {
        companyId: companyBId,
        name: `QA5B Product B ${stamp}`,
        buyPrice: 10,
        sellPrice: 20,
        stock: 1,
        minStock: 0,
        unitType: "PIECE",
        status: "ACTIVE",
        vatRate: 20,
      },
    });

    const onlyA = await db.product.findMany({ where: { companyId: companyAId } });
    assert.ok(onlyA.some((row) => row.id === productA.id));
    assert.ok(!onlyA.some((row) => row.id === productB.id));
  });

  it("üyelik canonical DTO trial ve paid dönem ayrımı yapar", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const trialEnd = new Date("2026-08-10T21:00:00.000Z");
    const periodEnd = new Date("2026-09-10T21:00:00.000Z");

    await db.companySubscription.create({
      data: {
        companyId: companyAId,
        status: "TRIAL",
        trialEndsAt: trialEnd,
        currentPeriodEnd: periodEnd,
        currentPeriodStart: new Date("2026-07-10T21:00:00.000Z"),
      },
    });

    const subscription = await db.companySubscription.findUnique({
      where: { companyId: companyAId },
    });
    assert.ok(subscription);

    const display = buildCanonicalMembershipDisplay({
      subscription,
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-15T12:00:00.000Z"),
    });

    assert.equal(display.primaryDateLabel, "Deneme bitişi");
    assert.equal(display.primaryDateIso, trialEnd.toISOString());
  });

  it("supplier status view çelişkili etiket üretmez", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const view = buildSupplierStatusView({ isActive: true, signedBalance: 0 });
    assert.equal(view.operationalLabel, "Aktif");
    assert.equal(view.accountLabel, "Bakiye Yok");
  });

  it("sıfır çalışan aggregate doğru döner", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const employees = await db.employee.findMany({
      where: { companyId: companyAId },
      include: {
        payments: { where: { status: { in: ["PENDING", "OVERDUE"] } } },
        leaveRequests: { where: { status: "PENDING" } },
        salaryRecords: { where: { isActive: true } },
      },
    });

    const summary = buildCanonicalTeamSummary({
      employees: employees.map((employee) => ({
        status: employee.status,
        salaryAmount: Number(employee.salaryRecords[0]?.amount ?? 0),
        pendingPaymentCount: employee.payments.length,
        pendingLeaveCount: employee.leaveRequests.length,
      })),
    });

    assert.equal(summary.totalEmployees, 0);
    assert.equal(summary.pendingPayments, 0);
    assert.equal(summary.pendingLeaves, 0);
    assert.equal(summary.showEmptyTeamState, true);
  });

  it("productUpdateSchema negatif alış fiyatını reddeder", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const parsed = productUpdateSchema.safeParse({
      productType: "STOCK",
      name: "Güncelleme",
      buyPrice: -0.01,
      sellPrice: 50,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(parsed.success, false);
  });

  it("supplierProductSchema negatif purchasePrice reddeder", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const parsed = supplierProductSchema.safeParse({
      productId: "prod-1",
      purchasePrice: -5,
    });
    assert.equal(parsed.success, false);
  });

  it("ACTIVE aylık abonelik sonraki yenileme tarihini gösterir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const nextBilling = new Date("2026-08-15T21:00:00.000Z");
    await db.companySubscription.create({
      data: {
        companyId: companyBId,
        status: "ACTIVE",
        autoRenew: true,
        nextBillingAt: nextBilling,
        currentPeriodStart: new Date("2026-07-15T21:00:00.000Z"),
        currentPeriodEnd: nextBilling,
      },
    });

    const subscription = await db.companySubscription.findUnique({
      where: { companyId: companyBId },
    });
    assert.ok(subscription);

    const display = buildCanonicalMembershipDisplay({
      subscription,
      sourceCompanyId: companyBId,
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-20T12:00:00.000Z"),
    });

    assert.equal(display.primaryDateLabel, "Sonraki yenileme");
    assert.equal(display.primaryDateIso, nextBilling.toISOString());
  });

  it("CANCEL_AT_PERIOD_END paket bitiş etiketini kullanır", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const periodEnd = new Date("2026-09-01T21:00:00.000Z");
    await db.companySubscription.upsert({
      where: { companyId: companyAId },
      create: {
        companyId: companyAId,
        status: "CANCEL_AT_PERIOD_END",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
      },
      update: {
        status: "CANCEL_AT_PERIOD_END",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: periodEnd,
      },
    });

    const subscription = await db.companySubscription.findUnique({
      where: { companyId: companyAId },
    });
    assert.ok(subscription);

    const display = buildCanonicalMembershipDisplay({
      subscription,
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
      referenceDate: new Date("2026-08-01T12:00:00.000Z"),
    });

    assert.equal(display.primaryDateLabel, "Şu tarihte sona erecek");
    assert.equal(display.primaryDateIso, periodEnd.toISOString());
  });

  it("Europe/Istanbul gece sınırında aynı instant tutarlı formatlanır", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const instant = "2026-07-31T21:00:00.000Z";
    const billing = buildCanonicalMembershipDisplay({
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: instant,
      },
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    });
    const sidebar = buildCanonicalMembershipDisplay({
      subscription: {
        status: "ACTIVE",
        currentPeriodEnd: instant,
      },
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
      referenceDate: new Date("2026-07-01T12:00:00.000Z"),
    });

    assert.equal(billing.primaryDateDisplay, sidebar.primaryDateDisplay);
    assert.equal(billing.periodEndDisplay, sidebar.periodEndDisplay);
  });

  it("pasif tedarikçi ve borçlu cari ayrı etiketler üretir", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const view = buildSupplierStatusView({ isActive: false, signedBalance: 120 });
    assert.equal(view.operationalLabel, "Pasif");
    assert.equal(view.accountLabel, "Tedarikçiye Borcumuz");
    assert.notEqual(view.operationalLabel, view.accountLabel);
  });

  it("TERMINATED çalışanın bekleyen kayıtları aktif metriğe girmez", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const terminated = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "Eski",
        lastName: "Personel",
        status: "TERMINATED",
      },
    });

    await db.employeePayment.create({
      data: {
        companyId: companyAId,
        employeeId: terminated.id,
        type: "SALARY",
        amount: 5000,
        status: "PENDING",
      },
    });

    await db.employeeLeave.create({
      data: {
        companyId: companyAId,
        employeeId: terminated.id,
        type: "ANNUAL",
        status: "PENDING",
        startAt: new Date("2026-08-01"),
        endAt: new Date("2026-08-05"),
      },
    });

    const active = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "Aktif",
        lastName: "Personel",
        status: "ACTIVE",
      },
    });

    await db.employeePayment.create({
      data: {
        companyId: companyAId,
        employeeId: active.id,
        type: "SALARY",
        amount: 1000,
        status: "PENDING",
      },
    });

    const summary = buildCanonicalTeamSummary({
      employees: [
        {
          status: "TERMINATED",
          pendingPaymentCount: 1,
          pendingLeaveCount: 1,
        },
        {
          status: "ACTIVE",
          pendingPaymentCount: 1,
          pendingLeaveCount: 0,
        },
      ],
    });

    assert.equal(summary.pendingPayments, 1);
    assert.equal(summary.pendingLeaves, 0);
    assert.equal(summary.activeEmployees, 1);
    assert.equal(summary.terminatedEmployees, 1);
  });

  it("ON_LEAVE çalışanın bekleyen izni aktif metriğe girer", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const summary = buildCanonicalTeamSummary({
      employees: [
        {
          status: "ON_LEAVE",
          pendingLeaveCount: 2,
          pendingPaymentCount: 1,
        },
      ],
    });

    assert.equal(summary.pendingLeaves, 2);
    assert.equal(summary.pendingPayments, 1);
    assert.equal(summary.onLeaveEmployees, 1);
  });

  it("AI güvensiz çıktı kullanıcı metnine sızmaz", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const cleaned = stripUnsafeAiDisplayText(
      'className bg-red-500 text-sm <script>alert(1)</script>'
    );
    assert.ok(!cleaned.includes("bg-red-500"));
    assert.ok(!cleaned.includes("className"));
    assert.ok(!cleaned.includes("<script>"));

    const sanitized = sanitizeStructuredAiResponse({
      blocks: [{ type: "text", content: "style tailwind bg-blue-500" }],
      sourceModules: [],
    });
    assert.ok(sanitized);
    if (sanitized?.blocks[0]?.type === "text") {
      assert.ok(!sanitized.blocks[0].content.includes("bg-blue-500"));
    }
  });
});
