/**
 * QA Faz 5B.3 — toplu fiyat ayarlama negatif sonuç kapanışı (DB)
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import {
  BULK_PRICE_NEGATIVE_BATCH_ERROR,
  bulkAdjustProductPrices,
} from "@/lib/product-bulk-service";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const DB_TARGET_CONFIGURED =
  !!TEST_DB_URL && TEST_DB_URL.includes("hesapisleri_test");

describe("QA Faz 5B.3 — bulk price DB integration", () => {
  let db: PrismaClient | null = null;
  let dbReady = false;
  let companyAId = "";
  let companyBId = "";
  let userId = "";
  const stamp = `qa5b3-${Date.now()}`;

  before(async () => {
    if (!DB_TARGET_CONFIGURED) return;

    try {
      const { PrismaClient } = await import("@prisma/client");
      db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
      await db.$connect();
      dbReady = true;

      const { hashPassword } = await import("@/lib/auth");
      const hash = await hashPassword("TestPass123!");

      const user = await db.user.create({
        data: {
          email: `${stamp}@qa.internal`,
          password: hash,
          name: "QA 5B3",
          role: "OWNER",
          status: "ACTIVE",
          sessionVersion: 1,
          loginTrackingStatus: "NEVER_LOGGED_IN",
        },
      });
      userId = user.id;

      const companyA = await db.company.create({
        data: { name: `QA5B3_A_${stamp}`, status: "ACTIVE" },
      });
      companyAId = companyA.id;

      const companyB = await db.company.create({
        data: { name: `QA5B3_B_${stamp}`, status: "ACTIVE" },
      });
      companyBId = companyB.id;
    } catch {
      dbReady = false;
    }
  });

  after(async () => {
    if (!db || !dbReady) return;

    await db.activityLog.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.product.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.company.deleteMany({
      where: { id: { in: [companyAId, companyBId] } },
    });
    await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  });

  async function createProduct(
    companyId: string,
    name: string,
    sellPrice: number,
    buyPrice = 10
  ) {
    return db!.product.create({
      data: {
        companyId,
        name,
        buyPrice,
        sellPrice,
        stock: 1,
        minStock: 0,
        unitType: "PIECE",
        status: "ACTIVE",
        vatRate: 20,
      },
    });
  }

  it("A: geçerli yüzde indirimi uygular", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const product = await createProduct(companyAId, `Yüzde ${stamp}`, 100);
    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [product.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "percent",
        value: 10,
      }
    );

    assert.equal(result.ok, true);
    const updated = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(updated?.sellPrice), 90);
  });

  it("B: geçerli sabit indirim uygular", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const product = await createProduct(companyAId, `Sabit ${stamp}`, 100);
    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [product.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(result.ok, true);
    const updated = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(updated?.sellPrice), 90);
  });

  it("C: negatif nihai fiyat batch'i reddeder, fiyat ve log korunur", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const product = await createProduct(companyAId, `Negatif ${stamp}`, 5);
    const beforeLogs = await db.activityLog.count({
      where: { companyId: companyAId, module: "products" },
    });

    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [product.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NEGATIVE_PRICE_RESULT");
      assert.equal(result.message, BULK_PRICE_NEGATIVE_BATCH_ERROR);
      assert.equal(result.affectedProductCount, 1);
      assert.equal(result.violations?.[0]?.newPrice, -5);
    }

    const updated = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(updated?.sellPrice), 5);

    const afterLogs = await db.activityLog.count({
      where: { companyId: companyAId, module: "products" },
    });
    assert.equal(afterLogs, beforeLogs);
  });

  it("D: karışık batchte hiçbir ürün güncellenmez", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const valid = await createProduct(companyAId, `Geçerli ${stamp}`, 100);
    const invalid = await createProduct(companyAId, `Geçersiz ${stamp}`, 5);

    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [valid.id, invalid.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(result.ok, false);
    const validAfter = await db.product.findUnique({ where: { id: valid.id } });
    const invalidAfter = await db.product.findUnique({ where: { id: invalid.id } });
    assert.equal(Number(validAfter?.sellPrice), 100);
    assert.equal(Number(invalidAfter?.sellPrice), 5);
  });

  it("E: tam sıfır fiyat kabul edilir", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const product = await createProduct(companyAId, `Sıfır ${stamp}`, 10);
    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [product.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(result.ok, true);
    const updated = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(updated?.sellPrice), 0);
  });

  it("F: başka tenant ürünü kapsama alınmaz", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const productA = await createProduct(companyAId, `Tenant A ${stamp}`, 100);
    const productB = await createProduct(companyBId, `Tenant B ${stamp}`, 100);

    const result = await bulkAdjustProductPrices(
      companyAId,
      userId,
      [productA.id, productB.id],
      {
        priceField: "sell",
        direction: "decrease",
        mode: "fixed",
        value: 10,
      }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "TENANT_SCOPE_MISMATCH");
      assert.ok(result.missingProductIds?.includes(productB.id));
    }

    const bAfter = await db.product.findUnique({ where: { id: productB.id } });
    assert.equal(Number(bAfter?.sellPrice), 100);
  });

  it("G: ardışık iki geçerli çağrı beklenen şekilde uygulanır", async (t) => {
    if (!DB_TARGET_CONFIGURED || !dbReady || !db) {
      t.skip("DB unavailable");
      return;
    }

    const product = await createProduct(companyAId, `Duplicate ${stamp}`, 100);
    const input = {
      priceField: "sell" as const,
      direction: "decrease" as const,
      mode: "percent" as const,
      value: 10,
    };

    const first = await bulkAdjustProductPrices(companyAId, userId, [product.id], input);
    const second = await bulkAdjustProductPrices(companyAId, userId, [product.id], input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);

    const updated = await db.product.findUnique({ where: { id: product.id } });
    assert.equal(Number(updated?.sellPrice), 81);
  });
});
