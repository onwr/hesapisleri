/**
 * QA Faz 2 — PostgreSQL entegrasyon: demo cleanup, activity tenant scope, legacy XSS.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  assertDemoTenantCompany,
  DEMO_TAX_NO,
} from "@/lib/demo-tenant";
import {
  mapActivityLogToDashboardItem,
  createActivityLog,
} from "@/lib/activity-log-utils";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_AVAILABLE =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: QA DB tests require TEST_DATABASE_URL pointing to hesapisleri_test";

describe("QA Faz 2 — demo tenant DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let demoCompanyId: string;
  let productionCompanyId: string;
  let userId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const user = await db.user.create({
      data: {
        email: `qa-faz2-${Date.now()}@qa.internal`,
        password: hash,
        name: "QA Faz2",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    userId = user.id;

    const demo = await db.company.create({
      data: {
        name: `QA Demo ${Date.now()}`,
        taxNo: DEMO_TAX_NO,
        status: "ACTIVE",
      },
    });
    demoCompanyId = demo.id;

    const production = await db.company.create({
      data: {
        name: `QA ProdLike ${Date.now()}`,
        taxNo: `QA-PROD-${Date.now()}`,
        status: "ACTIVE",
      },
    });
    productionCompanyId = production.id;

    await db.companyUser.createMany({
      data: [
        {
          userId,
          companyId: demoCompanyId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
        {
          userId,
          companyId: productionCompanyId,
          role: "OWNER",
          status: "ACTIVE",
          isOwner: true,
        },
      ],
    });
  });

  after(async () => {
    const companies = await db.company.findMany({
      where: {
        OR: [
          { taxNo: DEMO_TAX_NO, name: { startsWith: "QA Demo" } },
          { name: { startsWith: "QA ProdLike" } },
        ],
      },
      select: { id: true },
    });
    const companyIds = companies.map((c) => c.id);

    if (companyIds.length > 0) {
      await db.activityLog.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.companyUser.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await db.company.deleteMany({ where: { id: { in: companyIds } } });
    }

    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }

    await db.$disconnect();
  });

  it("production tenant assertDemoTenantCompany ile reddedilir", () => {
    assert.throws(
      () =>
        assertDemoTenantCompany({
          id: productionCompanyId,
          taxNo: `QA-PROD-${Date.now()}`,
        }),
      /canonical demo tenant/i
    );
  });

  it("demo tenant assertDemoTenantCompany kabul eder", () => {
    assert.doesNotThrow(() =>
      assertDemoTenantCompany({ id: demoCompanyId, taxNo: DEMO_TAX_NO })
    );
  });

  it("legacy XSS activity log dashboardda güvenli title üretir", async () => {
    const log = await db.activityLog.create({
      data: {
        companyId: demoCompanyId,
        userId,
        action: "CREATE",
        module: "expenses",
        message: '<img src=x onerror=alert(1)>',
      },
    });

    const item = mapActivityLogToDashboardItem(
      log,
      () => "Az önce"
    );

    assert.ok(item);
    assert.equal(item?.title, "[Geçersiz kayıt]");
    assert.doesNotMatch(item?.title ?? "", /</);

    await db.activityLog.delete({ where: { id: log.id } });
  });

  it("createActivityLog yeni XSS mesajını reddeder", async () => {
    await assert.rejects(
      () =>
        createActivityLog({
          companyId: demoCompanyId,
          userId,
          action: "CREATE",
          module: "expenses",
          message: '<script>alert(1)</script>',
        }),
      /invalid content/i
    );
  });

  it("activity log sorgusu tenant scope ile izole", async () => {
    const demoLog = await db.activityLog.create({
      data: {
        companyId: demoCompanyId,
        userId,
        action: "CREATE",
        module: "products",
        message: "QA Faz2 demo tenant ürün kaydı.",
      },
    });

    const prodLog = await db.activityLog.create({
      data: {
        companyId: productionCompanyId,
        userId,
        action: "CREATE",
        module: "products",
        message: "QA Faz2 production tenant ürün kaydı.",
      },
    });

    const demoOnly = await db.activityLog.findMany({
      where: { companyId: demoCompanyId, message: { contains: "QA Faz2" } },
    });
    const prodOnly = await db.activityLog.findMany({
      where: {
        companyId: productionCompanyId,
        message: { contains: "QA Faz2" },
      },
    });

    assert.equal(demoOnly.length, 1);
    assert.equal(prodOnly.length, 1);
    assert.equal(demoOnly[0]?.id, demoLog.id);
    assert.equal(prodOnly[0]?.id, prodLog.id);

    await db.activityLog.deleteMany({
      where: { id: { in: [demoLog.id, prodLog.id] } },
    });
  });

  it("demo cleanup yalnız demo tenant activity kayıtlarını hedefler", async () => {
    const unsafeDemo = await db.activityLog.create({
      data: {
        companyId: demoCompanyId,
        userId,
        action: "CREATE",
        module: "expenses",
        message: '<img src=x onerror=alert(1)>',
      },
    });

    const safeProd = await db.activityLog.create({
      data: {
        companyId: productionCompanyId,
        userId,
        action: "CREATE",
        module: "expenses",
        message: "Gerçek gider kaydı QA Faz2.",
      },
    });

    const beforeProd = await db.activityLog.count({
      where: { companyId: productionCompanyId },
    });

    await db.activityLog.deleteMany({
      where: {
        companyId: demoCompanyId,
        id: unsafeDemo.id,
      },
    });

    const afterProd = await db.activityLog.count({
      where: { companyId: productionCompanyId },
    });
    const prodStillThere = await db.activityLog.findUnique({
      where: { id: safeProd.id },
    });

    assert.equal(beforeProd, afterProd);
    assert.ok(prodStillThere);

    await db.activityLog.delete({ where: { id: safeProd.id } });
  });
});
