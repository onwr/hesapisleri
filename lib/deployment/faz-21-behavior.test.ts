import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextConfig from "../../next.config";
import {
  PosCheckoutIdempotencyError,
  buildPosCheckoutPayloadHash,
  validatePosIdempotencyKey,
} from "@/lib/pos-checkout-idempotency";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import { createCompanyForUser } from "@/lib/create-company-service";
import {
  formatEnvValidationReport,
  validateProductionEnvironment,
} from "@/lib/deployment/env-validation";
import {
  executePosCheckout,
  SaleStockValidationError,
} from "@/lib/pos-checkout-service";
import { db } from "@/lib/prisma";

// TEST_DATABASE_URL yoksa gerçek DB testleri KONTROLLÜ skip edilir — before()
// hook'u hiç çalışmaz, bağlantı hatası fırlatıp suite'i "cancelled" duruma
// düşürmez.
const dbTestOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: "TEST_DATABASE_URL tanımlı değil — gerçek DB entegrasyon testi atlandı." };

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(webRoot, "..");

function read(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRepo(rel: string) {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function buildCheckoutData(input: {
  productId: string;
  productName: string;
  accountId: string;
  idempotencyKey: string;
  quantity?: number;
  unitPrice?: number;
}) {
  const unitPrice = input.unitPrice ?? 100;
  const quantity = input.quantity ?? 1;
  const lineTotal = quantity * unitPrice;
  const vat = (lineTotal * 20) / 100;
  const total = lineTotal + vat;

  return {
    idempotencyKey: input.idempotencyKey,
    paymentStatus: "PAID" as const,
    discount: 0,
    items: [
      {
        productId: input.productId,
        name: input.productName,
        quantity,
        unitPrice,
        vatRate: 20,
      },
    ],
    payments: [
      {
        paymentMethod: "CASH" as const,
        amount: total,
        accountId: input.accountId,
      },
    ],
  };
}

type PosFixture = {
  stamp: string;
  companyA: { id: string };
  companyB: { id: string };
  userA: { id: string };
  userB: { id: string };
  productA: { id: string; name: string };
  productB: { id: string; name: string };
  warehouseA: { id: string };
  accountA: { id: string };
  accountB: { id: string };
  userIds: string[];
  companyIds: string[];
};

async function buildPosFixture(): Promise<PosFixture> {
  const stamp = `faz21-${Date.now()}`;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  const userA = await db.user.create({
    data: {
      email: `faz21-a-${stamp}@test.local`,
      password: "test-only",
      name: "Faz21 A",
      status: "ACTIVE",
    },
  });
  userIds.push(userA.id);

  const platformDefaults = {
    currency: PLATFORM_SETTINGS_DEFAULTS.defaultCurrency,
    defaultVatRate: PLATFORM_SETTINGS_DEFAULTS.defaultVatRate,
    trialDays: PLATFORM_SETTINGS_DEFAULTS.trialDays,
    trialAmount: PLATFORM_SETTINGS_DEFAULTS.trialAmount,
    notifyLowStock: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLowStock,
    notifyDueInvoices: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDueInvoices,
    notifyLateCollections: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyLateCollections,
    notifyDailySummary: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyDailySummary,
    notifyEmployeePayments: PLATFORM_SETTINGS_DEFAULTS.defaultNotifyEmployeePayments,
  };

  const companyA = await db.$transaction(async (tx) =>
    createCompanyForUser(tx, {
      userId: userA.id,
      name: `Faz21 A ${stamp}`,
      source: "NEW_COMPANY",
      platformDefaults,
    })
  );
  companyIds.push(companyA.company.id);

  const userB = await db.user.create({
    data: {
      email: `faz21-b-${stamp}@test.local`,
      password: "test-only",
      name: "Faz21 B",
      status: "ACTIVE",
    },
  });
  userIds.push(userB.id);

  const companyB = await db.$transaction(async (tx) =>
    createCompanyForUser(tx, {
      userId: userB.id,
      name: `Faz21 B ${stamp}`,
      source: "NEW_COMPANY",
      platformDefaults,
    })
  );
  companyIds.push(companyB.company.id);

  const [warehouseA, accountA, accountB] = await Promise.all([
    db.warehouse.findFirstOrThrow({
      where: { companyId: companyA.company.id, isDefault: true },
    }),
    db.account.findFirstOrThrow({
      where: { companyId: companyA.company.id, type: "CASH" },
    }),
    db.account.findFirstOrThrow({
      where: { companyId: companyB.company.id, type: "CASH" },
    }),
  ]);

  const productA = await db.product.create({
    data: {
      companyId: companyA.company.id,
      name: `Ürün A ${stamp}`,
      sku: `F21A-${stamp}`,
      productType: "STOCK",
      stock: 10,
      sellPrice: 100,
      status: "ACTIVE",
    },
  });

  const productB = await db.product.create({
    data: {
      companyId: companyB.company.id,
      name: `Ürün B ${stamp}`,
      sku: `F21B-${stamp}`,
      productType: "STOCK",
      stock: 10,
      sellPrice: 100,
      status: "ACTIVE",
    },
  });

  await db.warehouseStock.create({
    data: {
      companyId: companyA.company.id,
      productId: productA.id,
      warehouseId: warehouseA.id,
      quantity: 10,
    },
  });

  return {
    stamp,
    companyA: companyA.company,
    companyB: companyB.company,
    userA,
    userB,
    productA,
    productB,
    warehouseA,
    accountA,
    accountB,
    userIds,
    companyIds,
  };
}

async function cleanupPosFixture(f: PosFixture) {
  for (const companyId of f.companyIds) {
    await db.sale.deleteMany({ where: { companyId } }).catch(() => {});
    await db.company.delete({ where: { id: companyId } }).catch(() => {});
  }
  for (const userId of f.userIds) {
    await db.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

describe("Faz 21 — POS idempotency unit", () => {
  it("idempotency key format validasyonu", () => {
    assert.equal(validatePosIdempotencyKey("short"), "Geçersiz işlem anahtarı formatı.");
    assert.equal(validatePosIdempotencyKey("a".repeat(16)), null);
    assert.equal(validatePosIdempotencyKey(crypto.randomUUID()), null);
  });

  it("payload hash ödeme satırı tutarını kimlik için içerir; ayrı total alanı yok", () => {
    const base = {
      idempotencyKey: "a".repeat(16),
      paymentStatus: "PAID" as const,
      discount: 0,
      items: [
        {
          productId: "p1",
          name: "Test",
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      payments: [
        {
          paymentMethod: "CASH" as const,
          amount: 120,
          accountId: "acc1",
        },
      ],
    };
    const h1 = buildPosCheckoutPayloadHash(base);
    const h2 = buildPosCheckoutPayloadHash({
      ...base,
      items: [{ ...base.items[0]!, quantity: 2 }],
    });
    assert.notEqual(h1, h2);
  });
});

describe("Faz 21 — POS idempotency gerçek DB", { concurrency: false, ...dbTestOptions }, () => {
  let fixture: PosFixture | null = null;

  before(async () => {
    await db.$queryRaw`SELECT 1`;
  });

  after(async () => {
    if (fixture) {
      await cleanupPosFixture(fixture);
      fixture = null;
    }
  });

  async function withFixture<T>(fn: (f: PosFixture) => Promise<T>) {
    fixture = await buildPosFixture();
    try {
      return await fn(fixture);
    } finally {
      await cleanupPosFixture(fixture);
      fixture = null;
    }
  }

  it("aynı key iki kez → tek Sale, ikinci replay", async () => {
    await withFixture(async (f) => {
      const key = `idem-seq-${f.stamp}`;
      const data = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
      });

      const first = await executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data,
      });
      assert.equal(first.replayed, false);

      const second = await executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data,
      });
      assert.equal(second.replayed, true);
      assert.equal(first.sale.id, second.sale.id);

      const count = await db.sale.count({
        where: { companyId: f.companyA.id, idempotencyKey: key },
      });
      assert.equal(count, 1);
    });
  });

  it("aynı key paralel → tek Sale", async () => {
    await withFixture(async (f) => {
      const key = `idem-par-${f.stamp}`;
      const data = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
        quantity: 1,
      });

      await db.warehouseStock.updateMany({
        where: {
          companyId: f.companyA.id,
          productId: f.productA.id,
          warehouseId: f.warehouseA.id,
        },
        data: { quantity: 1 },
      });

      const results = await Promise.allSettled([
        executePosCheckout({ companyId: f.companyA.id, userId: f.userA.id, data }),
        executePosCheckout({ companyId: f.companyA.id, userId: f.userA.id, data }),
      ]);

      const ok = results.filter((r) => r.status === "fulfilled");
      assert.equal(ok.length, 2);
      const saleIds = ok.map(
        (r) =>
          (r as PromiseFulfilledResult<Awaited<ReturnType<typeof executePosCheckout>>>)
            .value.sale.id
      );
      assert.equal(new Set(saleIds).size, 1);

      const sales = await db.sale.count({
        where: { companyId: f.companyA.id, idempotencyKey: key },
      });
      assert.equal(sales, 1);

      const movements = await db.stockMovement.count({
        where: { companyId: f.companyA.id, productId: f.productA.id, type: "SALE" },
      });
      assert.equal(movements, 1);
    });
  });

  it("aynı key farklı sepet → conflict", async () => {
    await withFixture(async (f) => {
      const key = `idem-conflict-${f.stamp}`;
      const first = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
        quantity: 1,
      });

      await executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data: first,
      });

      const second = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
        quantity: 2,
      });

      await assert.rejects(
        () =>
          executePosCheckout({
            companyId: f.companyA.id,
            userId: f.userA.id,
            data: second,
          }),
        PosCheckoutIdempotencyError
      );
    });
  });

  it("aynı key farklı firma → bağımsız", async () => {
    await withFixture(async (f) => {
      const key = `idem-cross-co-${f.stamp}`;

      const whB = await db.warehouse.findFirstOrThrow({
        where: { companyId: f.companyB.id, isDefault: true },
      });
      await db.warehouseStock.create({
        data: {
          companyId: f.companyB.id,
          productId: f.productB.id,
          warehouseId: whB.id,
          quantity: 5,
        },
      });

      const dataA = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
      });
      const dataB = buildCheckoutData({
        productId: f.productB.id,
        productName: f.productB.name,
        accountId: f.accountB.id,
        idempotencyKey: key,
      });

      await executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data: dataA,
      });
      await executePosCheckout({
        companyId: f.companyB.id,
        userId: f.userB.id,
        data: dataB,
      });

      const total = await db.sale.count({ where: { idempotencyKey: key } });
      assert.equal(total, 2);
    });
  });

  it("başarısız stok sonrası aynı key ile retry → tek satış", async () => {
    await withFixture(async (f) => {
      const key = `idem-retry-${f.stamp}`;

      await db.warehouseStock.updateMany({
        where: {
          companyId: f.companyA.id,
          productId: f.productA.id,
          warehouseId: f.warehouseA.id,
        },
        data: { quantity: 0 },
      });

      const data = buildCheckoutData({
        productId: f.productA.id,
        productName: f.productA.name,
        accountId: f.accountA.id,
        idempotencyKey: key,
      });

      await assert.rejects(
        () =>
          executePosCheckout({
            companyId: f.companyA.id,
            userId: f.userA.id,
            data,
          }),
        SaleStockValidationError
      );

      await db.warehouseStock.updateMany({
        where: {
          companyId: f.companyA.id,
          productId: f.productA.id,
          warehouseId: f.warehouseA.id,
        },
        data: { quantity: 1 },
      });

      const ok = await executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data,
      });
      assert.equal(ok.replayed, false);

      const sales = await db.sale.count({
        where: { companyId: f.companyA.id, idempotencyKey: key },
      });
      assert.equal(sales, 1);

      const txCount = await db.accountTransaction.count({
        where: { accountId: f.accountA.id },
      });
      assert.ok(txCount >= 1);
    });
  });
});

describe("Faz 21 — env validation", () => {
  it("development ortamını bloklamaz", () => {
    const result = validateProductionEnvironment({
      NODE_ENV: "development",
    });
    assert.equal(result.ok, true);
  });

  it("production eksik env fail-fast — secret loglamaz", () => {
    const result = validateProductionEnvironment({
      NODE_ENV: "production",
      APP_ENV: "production",
    });
    assert.equal(result.ok, false);
    const report = formatEnvValidationReport(result);
    assert.ok(report.includes("DATABASE_URL"));
    assert.ok(!report.includes("postgresql://"));
  });
});

describe("Faz 21 — deployment contract", () => {
  it("Dockerfile multi-stage + non-root + healthcheck", () => {
    const dockerfile = read("Dockerfile");
    assert.ok(dockerfile.includes("AS builder"));
    assert.ok(dockerfile.includes("USER nextjs"));
    assert.ok(dockerfile.includes("HEALTHCHECK"));
    assert.ok(dockerfile.includes("/api/health/live"));
    assert.ok(!dockerfile.includes("migrate deploy"));
  });

  it("CI workflow PostgreSQL + test + docker build", () => {
    const ci = readRepo(".github/workflows/ci.yml");
    assert.ok(ci.includes("postgres:16"));
    assert.ok(ci.includes("npm test"));
    assert.ok(ci.includes("docker build"));
    assert.ok(!ci.includes("PAYTR_MERCHANT_KEY: real"));
  });

  it("health live secret sızdırmaz", async () => {
    const live = await import("@/app/api/health/live/route");
    const res = await live.GET();
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.secret, undefined);
  });

  it("health ready minimal yanıt", async () => {
    const ready = await import("@/app/api/health/ready/route");
    const res = await ready.GET();
    const body = await res.json();
    assert.equal(typeof body.ok, "boolean");
    assert.equal(body.DATABASE_URL, undefined);
  });

  it("cron schedule registry 10 job", () => {
    const doc = readRepo("docs/deployment/cron-schedules.md");
    const routes = [
      "billing-renewals",
      "billing-outbox",
      "payment-reconciliation",
      "marketplace-sync",
      "notifications",
      "exchange-rates",
      "discount-reservations",
      "membership-campaign-lifecycle",
      "usage-period-reset",
      "employee-performance",
    ];
    for (const route of routes) {
      assert.ok(doc.includes(route), route);
    }
  });

  it("production smoke read-only default", () => {
    const smoke = read("scripts/production-smoke.mjs");
    assert.ok(smoke.includes('process.env.SMOKE_WRITE === "1"'));
    assert.ok(smoke.includes("IS_PRODUCTION_TARGET"));
  });

  it("backup script production guard", () => {
    const ps1 = read("scripts/db-backup.ps1");
    assert.ok(ps1.includes("ALLOW_PRODUCTION_BACKUP"));
  });

  it("next.config standalone output", () => {
    assert.equal(nextConfig.output, "standalone");
  });

  it("rate limit in-memory uyarısı dokümante", () => {
    const src = read("lib/rate-limit.ts");
    assert.ok(src.includes("multi-instance"));
  });
});
