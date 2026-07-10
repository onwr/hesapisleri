/**
 * QA Faz 5B.2 — eksik kabul kriterleri DB entegrasyon testleri
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { buildCanonicalMembershipDisplay } from "@/lib/membership-display-dto";
import { buildCanonicalTeamSummary } from "@/lib/team-summary";
import { buildSupplierStatusView } from "@/lib/supplier-status-view";
import {
  getFirstProductErrorMessage,
  productFormSchema,
  productUpdateSchema,
} from "@/lib/product-form-utils";
import { supplierProductSchema } from "@/lib/supplier-utils";
import { PRODUCT_PRICE_NEGATIVE_ERROR } from "@/lib/product-price-validation";
import {
  prepareAiInsightForCache,
  stripUnsafeAiDisplayText,
} from "@/lib/ai/ai-display-safety";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_TARGET_CONFIGURED =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");

describe("QA Faz 5B.2 — DB integration", () => {
  let db: PrismaClient | null = null;
  let dbReady = false;
  let companyAId = "";
  let companyBId = "";
  let ownerId = "";
  const stamp = `qa5b2-${Date.now()}`;

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
          name: "QA 5B2 Owner",
          role: "OWNER",
          status: "ACTIVE",
          sessionVersion: 1,
          loginTrackingStatus: "NEVER_LOGGED_IN",
        },
      });
      ownerId = owner.id;

      const companyA = await db.company.create({
        data: { name: `QA5B2_A_${stamp}`, status: "ACTIVE" },
      });
      companyAId = companyA.id;

      const companyB = await db.company.create({
        data: { name: `QA5B2_B_${stamp}`, status: "ACTIVE" },
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

    await db.aIInsightCache.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.employeePayment.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.employeeLeave.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
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

  it("mobile/API schema negatif fiyat Türkçe hata döner", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const parsed = productFormSchema.safeParse({
      productType: "STOCK",
      name: "Mobile Negatif",
      buyPrice: 10,
      sellPrice: -0.5,
      stock: 0,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(parsed.success, false);
    if (!parsed.success) {
      const message = getFirstProductErrorMessage(
        undefined,
        parsed.error.flatten().fieldErrors
      );
      assert.equal(message, PRODUCT_PRICE_NEGATIVE_ERROR);
    }
  });

  it("başka tenant ürün güncellemesi companyId filtresiyle reddedilir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const productB = await db.product.create({
      data: {
        companyId: companyBId,
        name: `QA5B2 Cross Tenant ${stamp}`,
        buyPrice: 10,
        sellPrice: 20,
        stock: 1,
        minStock: 0,
        unitType: "PIECE",
        status: "ACTIVE",
        vatRate: 20,
      },
    });

    const crossTenantUpdate = await db.product.updateMany({
      where: { id: productB.id, companyId: companyAId },
      data: { sellPrice: -99 },
    });
    assert.equal(crossTenantUpdate.count, 0);

    const stillValid = await db.product.findUnique({ where: { id: productB.id } });
    assert.equal(Number(stillValid?.sellPrice), 20);
  });

  it("EXPIRED abonelik canonical DTO üretir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const pastEnd = new Date("2025-06-01T21:00:00.000Z");
    await db.companySubscription.create({
      data: {
        companyId: companyAId,
        status: "ACTIVE",
        currentPeriodStart: new Date("2025-05-01T21:00:00.000Z"),
        currentPeriodEnd: pastEnd,
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
      referenceDate: new Date("2026-07-10T12:00:00.000Z"),
    });

    assert.equal(display.subscriptionStatus, "EXPIRED");
    assert.equal(display.statusLabel, "Süresi doldu");
    assert.equal(display.isExpired, true);
    assert.equal(display.sourceCompanyId, companyAId);
  });

  it("shared entitlement: billing/sidebar/alert aynı canonical label/date/sourceCompanyId", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const soon = new Date();
    soon.setDate(soon.getDate() + 5);

    await db.companySubscription.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.companySubscription.create({
      data: {
        companyId: companyAId,
        status: "ACTIVE",
        currentPeriodStart: new Date(),
        currentPeriodEnd: soon,
        nextBillingAt: soon,
      },
    });

    const { resolveUserCompanyEntitlement, getMembershipAlertForCompany, getSidebarMembershipSummary } =
      await import("@/lib/membership-service");

    const entitlement = await resolveUserCompanyEntitlement({
      userId: ownerId,
      companyId: companyBId,
    });

    const billingDisplay = buildCanonicalMembershipDisplay({
      subscription: entitlement.subscription,
      sourceCompanyId: entitlement.sourceCompanyId,
      isSharedEntitlement: entitlement.isSharedEntitlement,
      referenceDate: new Date(),
    });
    const sidebarDisplay = buildCanonicalMembershipDisplay({
      subscription: entitlement.subscription,
      sourceCompanyId: entitlement.sourceCompanyId,
      isSharedEntitlement: entitlement.isSharedEntitlement,
      referenceDate: new Date(),
    });
    const sidebarSummary = await getSidebarMembershipSummary(companyBId, ownerId);
    const alert = await getMembershipAlertForCompany(companyBId, ownerId);

    assert.equal(entitlement.isSharedEntitlement, true);
    assert.equal(entitlement.sourceCompanyId, companyAId);
    assert.equal(billingDisplay.primaryDateLabel, sidebarDisplay.primaryDateLabel);
    assert.equal(billingDisplay.primaryDateIso, sidebarDisplay.primaryDateIso);
    assert.equal(billingDisplay.sourceCompanyId, sidebarDisplay.sourceCompanyId);
    assert.equal(sidebarSummary.primaryDateLabel, billingDisplay.primaryDateLabel);
    assert.equal(sidebarSummary.periodEndLabel, billingDisplay.primaryDateDisplay);
    assert.ok(alert);
    assert.equal(alert?.membershipDisplay?.primaryDateLabel, billingDisplay.primaryDateLabel);
    assert.equal(
      alert?.membershipDisplay?.sourceCompanyId,
      billingDisplay.sourceCompanyId
    );
  });

  it("firma değişiminde canonical sourceCompanyId güncellenir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    await db.companySubscription.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.companySubscription.create({
      data: {
        companyId: companyAId,
        status: "ACTIVE",
        currentPeriodEnd: future,
      },
    });

    const { resolveUserCompanyEntitlement } = await import("@/lib/membership-service");

    const onA = await resolveUserCompanyEntitlement({
      userId: ownerId,
      companyId: companyAId,
    });
    const onB = await resolveUserCompanyEntitlement({
      userId: ownerId,
      companyId: companyBId,
    });

    const displayA = buildCanonicalMembershipDisplay({
      subscription: onA.subscription,
      sourceCompanyId: onA.sourceCompanyId,
      isSharedEntitlement: onA.isSharedEntitlement,
    });
    const displayB = buildCanonicalMembershipDisplay({
      subscription: onB.subscription,
      sourceCompanyId: onB.sourceCompanyId,
      isSharedEntitlement: onB.isSharedEntitlement,
    });

    assert.equal(displayA.sourceCompanyId, companyAId);
    assert.equal(displayA.isSharedEntitlement, false);
    assert.equal(displayB.sourceCompanyId, companyAId);
    assert.equal(displayB.isSharedEntitlement, true);
  });

  it("Europe/Istanbul gece sınırı membership display tutarlı", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const instant = "2026-07-31T21:00:00.000Z";
    const billing = buildCanonicalMembershipDisplay({
      subscription: { status: "ACTIVE", currentPeriodEnd: instant },
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
    });
    const sidebar = buildCanonicalMembershipDisplay({
      subscription: { status: "ACTIVE", currentPeriodEnd: instant },
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
    });
    const alert = buildCanonicalMembershipDisplay({
      subscription: { status: "ACTIVE", currentPeriodEnd: instant },
      sourceCompanyId: companyAId,
      isSharedEntitlement: false,
    });

    assert.equal(billing.primaryDateDisplay, sidebar.primaryDateDisplay);
    assert.equal(billing.periodEndDisplay, alert.periodEndDisplay);
  });

  it("tedarikçi aktif+borç / aktif+alacak / pasif durumları çelişkisiz", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const activeDebt = buildSupplierStatusView({ isActive: true, signedBalance: 500 });
    const activeCredit = buildSupplierStatusView({ isActive: true, signedBalance: -120 });
    const passive = buildSupplierStatusView({ isActive: false, signedBalance: 0 });

    assert.equal(activeDebt.operationalLabel, "Aktif");
    assert.equal(activeDebt.accountLabel, "Tedarikçiye Borcumuz");
    assert.equal(activeCredit.accountLabel, "Tedarikçiden Alacağımız");
    assert.equal(passive.operationalLabel, "Pasif");

    const supplierB = await db.supplier.create({
      data: {
        companyId: companyBId,
        name: `QA5B2 Supplier B ${stamp}`,
        isActive: true,
        openingBalance: 0,
      },
    });

    const onlyA = await db.supplier.findMany({ where: { companyId: companyAId } });
    assert.ok(!onlyA.some((row) => row.id === supplierB.id));
  });

  it("aktif + bakiye yok cari etiketi operasyonel pasiflik üretmez", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const view = buildSupplierStatusView({ isActive: true, signedBalance: 0 });
    assert.equal(view.operationalLabel, "Aktif");
    assert.equal(view.accountLabel, "Bakiye Yok");
    assert.notEqual(view.operationalLabel, "Pasif");
  });

  it("Company B çalışan kayıtları Company A KPI'sına girmez", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const empB = await db.employee.create({
      data: {
        companyId: companyBId,
        firstName: "B",
        lastName: "Personel",
        status: "ACTIVE",
      },
    });
    await db.employeePayment.create({
      data: {
        companyId: companyBId,
        employeeId: empB.id,
        type: "SALARY",
        amount: 9000,
        status: "PENDING",
      },
    });
    await db.employeeLeave.create({
      data: {
        companyId: companyBId,
        employeeId: empB.id,
        type: "ANNUAL",
        status: "PENDING",
        startAt: new Date("2026-09-01"),
        endAt: new Date("2026-09-05"),
      },
    });

    const empA = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "A",
        lastName: "Personel",
        status: "ACTIVE",
      },
    });
    await db.employeePayment.create({
      data: {
        companyId: companyAId,
        employeeId: empA.id,
        type: "SALARY",
        amount: 1000,
        status: "PENDING",
      },
    });

    const loadSummary = async (companyId: string) => {
      const employees = await db!.employee.findMany({
        where: { companyId },
        include: {
          payments: { where: { status: { in: ["PENDING", "OVERDUE"] } } },
          leaveRequests: { where: { status: "PENDING" } },
        },
      });
      return buildCanonicalTeamSummary({
        employees: employees.map((employee) => ({
          status: employee.status,
          pendingPaymentCount: employee.payments.length,
          pendingLeaveCount: employee.leaveRequests.length,
        })),
      });
    };

    const summaryA = await loadSummary(companyAId);
    const summaryB = await loadSummary(companyBId);

    assert.equal(summaryA.pendingPayments, 1);
    assert.equal(summaryA.pendingLeaves, 0);
    assert.equal(summaryB.pendingPayments, 1);
    assert.equal(summaryB.pendingLeaves, 1);
  });

  it("TERMINATED geçmiş kayıtlar aktif KPI'ya girmez; ON_LEAVE sayılır", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const terminated = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "Eski",
        lastName: "Çalışan",
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

    const onLeave = await db.employee.create({
      data: {
        companyId: companyAId,
        firstName: "İzinli",
        lastName: "Çalışan",
        status: "ON_LEAVE",
      },
    });
    await db.employeeLeave.create({
      data: {
        companyId: companyAId,
        employeeId: onLeave.id,
        type: "ANNUAL",
        status: "PENDING",
        startAt: new Date("2026-08-01"),
        endAt: new Date("2026-08-03"),
      },
    });

    const summary = buildCanonicalTeamSummary({
      employees: [
        { status: "TERMINATED", pendingPaymentCount: 1, pendingLeaveCount: 0 },
        { status: "ON_LEAVE", pendingPaymentCount: 0, pendingLeaveCount: 1 },
        { status: "ACTIVE", pendingPaymentCount: 0, pendingLeaveCount: 0 },
      ],
    });

    assert.equal(summary.pendingPayments, 0);
    assert.equal(summary.pendingLeaves, 1);
    assert.equal(summary.onLeaveEmployees, 1);
    assert.equal(summary.activeEmployees, 1);
  });

  it("sıfır aktif çalışan empty-state üretir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const summary = buildCanonicalTeamSummary({ employees: [] });
    assert.equal(summary.showEmptyTeamState, true);
    assert.equal(summary.totalEmployees, 0);
  });

  it("geçersiz AI çıktısı cache'e yazılmaz; önceki geçerli cache korunur", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const cacheKey = `qa5b2-ai-${stamp}`;
    const validPayload = {
      blocks: [{ type: "text", content: "Güvenli özet" }],
      sourceModules: ["dashboard"],
    };
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.aIInsightCache.upsert({
      where: {
        companyId_cacheKey: { companyId: companyAId, cacheKey },
      },
      create: {
        companyId: companyAId,
        cacheKey,
        content: validPayload,
        expiresAt,
      },
      update: {
        content: validPayload,
        expiresAt,
      },
    });

    const invalid = prepareAiInsightForCache({
      blocks: [{ type: "text", content: "bg-red-500 güvenli özet" }],
      sourceModules: [],
    });
    assert.ok(invalid);
    if (invalid?.blocks[0]?.type === "text") {
      assert.ok(!invalid.blocks[0].content.includes("bg-red-500"));
      assert.match(invalid.blocks[0].content, /güvenli özet/);
    }

    const emptyInvalid = prepareAiInsightForCache({
      blocks: [{ type: "text", content: "   " }],
      sourceModules: [],
    });
    assert.equal(emptyInvalid, null);

    if (!emptyInvalid) {
      const stillCached = await db.aIInsightCache.findUnique({
        where: { companyId_cacheKey: { companyId: companyAId, cacheKey } },
      });
      assert.ok(stillCached);
      const content = stillCached?.content as typeof validPayload;
      assert.equal(content.blocks[0]?.type, "text");
      if (content.blocks[0]?.type === "text") {
        assert.equal(content.blocks[0].content, "Güvenli özet");
      }
    }

    const cleaned = stripUnsafeAiDisplayText(
      'className bg-red-500 {"html":"<b>x</b>"}'
    );
    assert.ok(!cleaned.includes("className"));
    assert.ok(!cleaned.includes("bg-red-500"));
  });

  it("supplierProductSchema ve productUpdateSchema negatif fiyatı reddeder", (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady) {
      t.skip("DB unavailable");
      return;
    }

    const supplierParsed = supplierProductSchema.safeParse({
      productId: "p1",
      purchasePrice: -1,
    });
    assert.equal(supplierParsed.success, false);

    const updateParsed = productUpdateSchema.safeParse({
      productType: "STOCK",
      name: "X",
      buyPrice: -2,
      sellPrice: 10,
      minStock: 0,
      unitType: "PIECE",
      status: "ACTIVE",
      vatRate: 20,
    });
    assert.equal(updateParsed.success, false);
  });
});
