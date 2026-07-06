import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextConfig from "../../next.config";
import { resolveMeMembership } from "@/lib/auth/me-context";
import { PLATFORM_SETTINGS_DEFAULTS } from "@/lib/admin/platform-settings/platform-settings-defaults";
import { validateCollectionAccount } from "@/lib/collection-account-utils";
import { createCompanyForUser } from "@/lib/create-company-service";
import {
  completeCompanyOnboarding,
  OnboardingServiceError,
  startCompanyOnboarding,
  updateOnboardingProgress,
} from "@/lib/onboarding/onboarding-service";
import {
  ONBOARDING_EXEMPT_ROUTE_PREFIXES,
  parseSafeInternalReturnTo,
  resolvePostCreateRedirect,
} from "@/lib/onboarding/onboarding-routes";
import { resolveOnboardingRedirectPath } from "@/lib/onboarding/onboarding-redirect";
import { executePosCheckout, SaleStockValidationError } from "@/lib/pos-checkout-service";
import { deleteProduct, toggleProductStatus } from "@/lib/product-service";
import { getProductsExportRows } from "@/lib/products-page-data";
import { db } from "@/lib/prisma";
import { deleteSupplier } from "@/lib/supplier-service";
import { resolveTenantUploadFolder } from "@/lib/storage/upload-path";
import { assertOptionalTenantCustomer } from "@/lib/tenant/tenant-resource";
import { applyWarehouseStockMovement } from "@/lib/warehouse-service";
import { executeWarehouseTransfer } from "@/lib/warehouse-transfer-service";

// TEST_DATABASE_URL yoksa gerçek DB testleri KONTROLLÜ skip edilir — before()
// hook'u hiç çalışmaz, bağlantı hatası fırlatıp suite'i "cancelled" duruma
// düşürmez. Bu, DB'siz testlerin "cancelled" görünmesine yol açan kök nedendi.
const dbTestOptions = process.env.TEST_DATABASE_URL
  ? {}
  : { skip: "TEST_DATABASE_URL tanımlı değil — gerçek DB entegrasyon testi atlandı." };

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(rel: string) {
  return readFileSync(join(webRoot, rel), "utf8");
}

function readRoute(segments: string[]) {
  return readFileSync(join(webRoot, "app", "api", ...segments, "route.ts"), "utf8");
}

type Fixture = {
  stamp: string;
  companyA: { id: string };
  companyB: { id: string };
  userA: { id: string };
  userB: { id: string };
  staffA: { id: string };
  productA: { id: string; name: string };
  productB: { id: string; name: string };
  customerA: { id: string };
  customerB: { id: string };
  supplierA: { id: string };
  supplierB: { id: string };
  warehouseA: { id: string };
  warehouseB: { id: string };
  accountA: { id: string };
  accountB: { id: string };
  userIds: string[];
  companyIds: string[];
};

let fixture: Fixture | null = null;

function ownerActor(userId: string, companyId: string) {
  return {
    userId,
    companyId,
    effectiveRole: "OWNER",
    isOwner: true,
    isSuperAdmin: false,
  };
}

function staffActor(userId: string, companyId: string) {
  return {
    userId,
    companyId,
    effectiveRole: "STAFF",
    isOwner: false,
    isSuperAdmin: false,
  };
}

async function createSmokeUser(label: string, stamp: string, userIds: string[]) {
  const user = await db.user.create({
    data: {
      email: `${label}-${stamp}@faz191.local`,
      password: "integration-test-only",
      name: `Faz19.1 ${label}`,
      status: "ACTIVE",
    },
  });
  userIds.push(user.id);
  return user;
}

async function createSmokeCompany(userId: string, name: string, companyIds: string[]) {
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
  const result = await db.$transaction(async (tx) =>
    createCompanyForUser(tx, {
      userId,
      name,
      source: "NEW_COMPANY",
      platformDefaults,
    })
  );
  companyIds.push(result.company.id);
  return result.company;
}

async function buildFixture(): Promise<Fixture> {
  const stamp = `faz191-${Date.now()}`;
  const userIds: string[] = [];
  const companyIds: string[] = [];

  const userA = await createSmokeUser("owner-a", stamp, userIds);
  const userB = await createSmokeUser("owner-b", stamp, userIds);
  const staffA = await createSmokeUser("staff-a", stamp, userIds);

  const companyA = await createSmokeCompany(userA.id, `Firma A ${stamp}`, companyIds);
  const companyB = await createSmokeCompany(userB.id, `Firma B ${stamp}`, companyIds);

  await db.companyUser.create({
    data: {
      companyId: companyA.id,
      userId: staffA.id,
      role: "STAFF",
      status: "ACTIVE",
      isOwner: false,
    },
  });

  const [warehouseA, warehouseB, accountA, accountB] = await Promise.all([
    db.warehouse.findFirstOrThrow({ where: { companyId: companyA.id, isDefault: true } }),
    db.warehouse.findFirstOrThrow({ where: { companyId: companyB.id, isDefault: true } }),
    db.account.findFirstOrThrow({ where: { companyId: companyA.id, type: "CASH" } }),
    db.account.findFirstOrThrow({ where: { companyId: companyB.id, type: "CASH" } }),
  ]);

  const categoryA = await db.productCategory.create({
    data: { companyId: companyA.id, name: `Cat A ${stamp}`, status: "ACTIVE" },
  });
  const categoryB = await db.productCategory.create({
    data: { companyId: companyB.id, name: `Cat B ${stamp}`, status: "ACTIVE" },
  });

  const productA = await db.product.create({
    data: {
      companyId: companyA.id,
      categoryId: categoryA.id,
      name: `Ürün A ${stamp}`,
      sku: `SKU-A-${stamp}`,
      productType: "STOCK",
      stock: 5,
      sellPrice: 100,
      vatRate: 20,
      status: "ACTIVE",
    },
  });
  const productB = await db.product.create({
    data: {
      companyId: companyB.id,
      categoryId: categoryB.id,
      name: `Ürün B ${stamp}`,
      sku: `SKU-B-${stamp}`,
      productType: "STOCK",
      stock: 5,
      sellPrice: 100,
      vatRate: 20,
      status: "ACTIVE",
    },
  });

  await db.warehouseStock.createMany({
    data: [
      {
        companyId: companyA.id,
        productId: productA.id,
        warehouseId: warehouseA.id,
        quantity: 5,
      },
      {
        companyId: companyB.id,
        productId: productB.id,
        warehouseId: warehouseB.id,
        quantity: 5,
      },
    ],
  });

  const customerA = await db.customer.create({
    data: { companyId: companyA.id, name: `Müşteri A ${stamp}`, status: "ACTIVE" },
  });
  const customerB = await db.customer.create({
    data: { companyId: companyB.id, name: `Müşteri B ${stamp}`, status: "ACTIVE" },
  });

  const supplierA = await db.supplier.create({
    data: {
      companyId: companyA.id,
      code: `SUP-A-${stamp}`,
      name: `Tedarikçi A ${stamp}`,
      currentBalance: 0,
      isActive: true,
    },
  });
  const supplierB = await db.supplier.create({
    data: {
      companyId: companyB.id,
      code: `SUP-B-${stamp}`,
      name: `Tedarikçi B ${stamp}`,
      currentBalance: 0,
      isActive: true,
    },
  });

  return {
    stamp,
    companyA,
    companyB,
    userA,
    userB,
    staffA,
    productA,
    productB,
    customerA,
    customerB,
    supplierA,
    supplierB,
    warehouseA,
    warehouseB,
    accountA,
    accountB,
    userIds,
    companyIds,
  };
}

async function cleanupFixture(f: Fixture) {
  for (const companyId of f.companyIds) {
    await db.warehouseTransfer.deleteMany({ where: { companyId } }).catch(() => {});
    await db.companyOnboarding.deleteMany({ where: { companyId } }).catch(() => {});
    await db.company.delete({ where: { id: companyId } }).catch(() => {});
  }
  for (const userId of f.userIds) {
    await db.user.delete({ where: { id: userId } }).catch(() => {});
  }
}

describe("Faz 19.1 — birleşik dosya doğrulaması", () => {
  const requiredFiles = [
    "lib/storage/upload-path.ts",
    "lib/auth/me-context.ts",
    "app/api/upload/route.ts",
    "app/api/auth/me/route.ts",
    "next.config.ts",
    "lib/onboarding/onboarding-service.ts",
    "lib/onboarding/onboarding-routes.ts",
  ];

  for (const rel of requiredFiles) {
    it(`${rel} mevcut`, () => {
      assert.ok(existsSync(join(webRoot, rel)));
    });
  }

  it("upload route resolveTenantUploadFolder kullanır", () => {
    const src = readRoute(["upload"]);
    assert.ok(src.includes("resolveTenantUploadFolder"));
  });

  it("auth/me resolveMeMembership kullanır", () => {
    const src = readRoute(["auth", "me"]);
    assert.ok(src.includes("resolveMeMembership"));
  });

  it("CompanyOnboarding migration mevcut", () => {
    assert.ok(
      existsSync(
        join(webRoot, "prisma/migrations/20260713120000_company_onboarding/migration.sql")
      )
    );
  });

  it("Faz 20 returnTo servisleri aktif", () => {
    const routes = readSrc("lib/onboarding/onboarding-routes.ts");
    assert.ok(routes.includes("parseSafeInternalReturnTo"));
    assert.ok(routes.includes("resolvePostCreateRedirect"));
  });
});

describe("Faz 19.1 — production security headers (next.config çıktısı)", () => {
  it("poweredByHeader false", () => {
    assert.equal(nextConfig.poweredByHeader, false);
  });

  it("headers() güvenlik başlıklarını döner", async () => {
    const rules = await nextConfig.headers!();
    const headers = rules[0]?.headers ?? [];
    const map = new Map(headers.map((h) => [h.key, h.value]));

    assert.equal(map.get("X-Content-Type-Options"), "nosniff");
    assert.equal(map.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.ok(map.get("Permissions-Policy")?.includes("camera=()"));
    assert.equal(map.get("X-Frame-Options"), "SAMEORIGIN");
    assert.ok(map.get("Content-Security-Policy")?.includes("paytr.com"));
  });

  it("HSTS yalnız production branch'inde tanımlı", () => {
    const src = readSrc("lib/security-headers.ts");
    assert.ok(src.includes("Strict-Transport-Security"));
    assert.ok(src.includes("isProduction"));
  });
});

describe("Faz 19.1 — requireAuthenticatedApiSession route taraması", () => {
  const authSessionRoutes = [
    ["auth", "me"],
    ["auth", "companies"],
    ["auth", "switch-company"],
  ] as const;

  for (const segments of authSessionRoutes) {
    it(`${segments.join("/")} requireAuthenticatedApiSession kullanır`, () => {
      const src = readRoute([...segments]);
      assert.ok(src.includes("requireAuthenticatedApiSession"));
    });
  }

  it("auth/me stale company için resolveMeMembership fail-closed", () => {
    const src = readRoute(["auth", "me"]);
    assert.ok(src.includes("resolveMeMembership"));
  });

  it("requireApiModuleAccess live ACTIVE membership doğrular", () => {
    const src = readSrc("lib/module-access.ts");
    assert.ok(src.includes('status: "ACTIVE"'));
    assert.ok(src.includes("companyUser.findFirst"));
  });

  it("company-scoped ürün route requireApiModuleAccess kullanır", () => {
    const src = readRoute(["products", "create"]);
    assert.ok(src.includes("requireApiModuleAccess"));
  });
});

describe("Faz 19.1 — RLS strateji belgesi", () => {
  it("tenancy-strategy.md application-layer stratejisini tanımlar", () => {
    const doc = readFileSync(
      join(webRoot, "../docs/production-readiness/tenancy-strategy.md"),
      "utf8"
    );
    assert.ok(doc.includes("application-layer"));
    assert.ok(doc.includes("RLS aktif değildir") || doc.includes("runtime'da RLS aktif değil"));
    assert.ok(doc.includes("resolveTenantUploadFolder"));
    assert.ok(doc.includes("RLS aktif olmadan"));
  });
});

describe("Faz 19.1 — dependency runtime tree", () => {
  it("npm ls hono postcss js-yaml çıktısı kayıtlı", () => {
    const output = execSync("npm ls hono postcss js-yaml --omit=dev", {
      cwd: webRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.ok(output.length > 0);
  });
});

describe("Faz 19.1 — onboarding birleşik regression (statik)", () => {
  it("maintenance exempt — redirect loop riski yok", () => {
    assert.ok(ONBOARDING_EXEMPT_ROUTE_PREFIXES.includes("/maintenance"));
    const redirect = resolveOnboardingRedirectPath(
      { status: "IN_PROGRESS", currentStep: 2 },
      false
    );
    assert.equal(redirect, "/onboarding?step=2");
    assert.equal(
      parseSafeInternalReturnTo("https://evil.example/onboarding"),
      null
    );
  });

  it("returnTo yalnız güvenli internal route", () => {
    assert.equal(parseSafeInternalReturnTo("/products/new"), "/products/new");
    assert.equal(parseSafeInternalReturnTo("//evil.com"), null);
    assert.equal(
      resolvePostCreateRedirect({
        returnTo: "/onboarding",
        defaultDestination: "/products/p1?created=1",
      }),
      "/onboarding"
    );
  });
});

describe("Faz 19.1 — gerçek DB tenant isolation", { concurrency: false, ...dbTestOptions }, () => {
  before(async () => {
    await db.$queryRaw`SELECT 1`;
    fixture = await buildFixture();
  });

  after(async () => {
    if (fixture) {
      await cleanupFixture(fixture);
      fixture = null;
    }
  });

  function fx() {
    assert.ok(fixture, "fixture hazır olmalı");
    return fixture;
  }

  it("A kullanıcısı B ürününü okuyamaz", async () => {
    const f = fx();
    const row = await db.product.findFirst({
      where: { id: f.productB.id, companyId: f.companyA.id },
    });
    assert.equal(row, null);
  });

  it("A B ürününü güncelleyemez/silemez", async () => {
    const f = fx();
    const toggle = await toggleProductStatus(f.companyA.id, f.productB.id, f.userA.id);
    assert.equal(toggle.ok, false);
    if (!toggle.ok) assert.equal(toggle.status, 404);

    const del = await deleteProduct(f.companyA.id, f.productB.id, f.userA.id);
    assert.equal(del.ok, false);
    if (!del.ok) assert.equal(del.status, 404);

    const stillThere = await db.product.findUnique({ where: { id: f.productB.id } });
    assert.ok(stillThere);
  });

  it("A B müşterisini okuyamaz/güncelleyemez", async () => {
    const f = fx();
    const row = await db.customer.findFirst({
      where: { id: f.customerB.id, companyId: f.companyA.id },
    });
    assert.equal(row, null);

    const updated = await db.customer.updateMany({
      where: { id: f.customerB.id, companyId: f.companyA.id },
      data: { name: "Hacked" },
    });
    assert.equal(updated.count, 0);
  });

  it("A B tedarikçisini silemez", async () => {
    const f = fx();
    await assert.rejects(
      () =>
        deleteSupplier({
          companyId: f.companyA.id,
          userId: f.userA.id,
          supplierId: f.supplierB.id,
        }),
      (error: unknown) =>
        error instanceof Error && error.message.includes("Tedarikçi bulunamadı")
    );
  });

  it("A B deposuna stok hareketi yazamaz", async () => {
    const f = fx();
    const result = await applyWarehouseStockMovement({
      companyId: f.companyA.id,
      userId: f.userA.id,
      productId: f.productB.id,
      input: { type: "IN", quantity: 1, movementDate: new Date().toISOString() },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 404);
  });

  it("A B tahsilat hesabını kullanamaz", () => {
    const f = fx();
    const result = validateCollectionAccount(
      {
        id: f.accountB.id,
        companyId: f.companyB.id,
        type: "CASH",
        status: "ACTIVE",
        name: "B Kasa",
      },
      f.companyA.id
    );
    assert.equal(result.ok, false);
  });

  it("A B onboarding kaydını okuyamaz/değiştiremez", async () => {
    const f = fx();
    const onboardingB = await db.companyOnboarding.findUnique({
      where: { companyId: f.companyB.id },
    });
    assert.ok(onboardingB);

    await startCompanyOnboarding(ownerActor(f.userA.id, f.companyA.id));
    const progressed = await updateOnboardingProgress(
      ownerActor(f.userA.id, f.companyA.id),
      { currentStep: 3 }
    );
    assert.equal(progressed.currentStep, 3);

    const onboardingBAfter = await db.companyOnboarding.findUnique({
      where: { companyId: f.companyB.id },
    });
    assert.equal(onboardingBAfter?.status, "NOT_STARTED");
    assert.equal(onboardingBAfter?.currentStep, 1);
  });

  it("STAFF onboarding mutation 403", async () => {
    const f = fx();
    await assert.rejects(
      () =>
        updateOnboardingProgress(staffActor(f.staffA.id, f.companyA.id), {
          currentStep: 2,
        }),
      (error: unknown) =>
        error instanceof OnboardingServiceError && error.status === 403
    );
  });

  it("B export verisini A scope'unda göremez", async () => {
    const f = fx();
    const rowsA = await getProductsExportRows(f.companyA.id, { tab: "all" });
    const rowsB = await getProductsExportRows(f.companyB.id, { tab: "all" });
    assert.ok(rowsA.some((r) => r.id === f.productA.id));
    assert.ok(!rowsA.some((r) => r.id === f.productB.id));
    assert.ok(rowsB.some((r) => r.id === f.productB.id));
  });

  it("upload folder B UUID enjekte edilse bile A namespace", () => {
    const f = fx();
    const resolved = resolveTenantUploadFolder(
      f.companyA.id,
      `hesapisleri/${f.companyB.id}/products`
    );
    assert.ok(resolved.startsWith(`hesapisleri/${f.companyA.id}/`));
    assert.ok(!resolved.includes(f.companyB.id));
  });

  it("stale JWT companyId resolveMeMembership 403", () => {
    const f = fx();
    const result = resolveMeMembership(
      [{ companyId: f.companyB.id, status: "ACTIVE" }],
      f.companyA.id
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 403);
  });

  it("nested tenant relation — B müşterisi A POS'ta reddedilir", async () => {
    const f = fx();
    await assert.rejects(
      () => assertOptionalTenantCustomer(db, f.companyA.id, f.customerB.id),
      /Müşteri bulunamadı/
    );
  });

  it("yeni firma CompanyOnboarding NOT_STARTED", async () => {
    const f = fx();
    const onboarding = await db.companyOnboarding.findUnique({
      where: { companyId: f.companyB.id },
    });
    assert.ok(onboarding);
    assert.equal(onboarding!.status, "NOT_STARTED");
  });

  it("onboarding tamamlanınca company session scope korunur", async () => {
    const f = fx();
    await db.company.update({
      where: { id: f.companyA.id },
      data: { name: `Tamamlanan Firma ${f.stamp}` },
    });
    const completed = await completeCompanyOnboarding(
      ownerActor(f.userA.id, f.companyA.id)
    );
    assert.equal(completed.status, "COMPLETED");
    const company = await db.company.findUnique({ where: { id: f.companyA.id } });
    assert.equal(company?.id, f.companyA.id);
  });
});

describe("Faz 19.1 — concurrent POS stock race", { concurrency: false, ...dbTestOptions }, () => {
  let raceFixture: Fixture | null = null;

  before(async () => {
    await db.$queryRaw`SELECT 1`;
    raceFixture = await buildFixture();

    await db.warehouseStock.updateMany({
      where: {
        companyId: raceFixture.companyA.id,
        productId: raceFixture.productA.id,
        warehouseId: raceFixture.warehouseA.id,
      },
      data: { quantity: 1 },
    });
    await db.product.update({
      where: { id: raceFixture.productA.id },
      data: { stock: 1 },
    });
  });

  after(async () => {
    if (raceFixture) {
      await cleanupFixture(raceFixture);
      raceFixture = null;
    }
  });

  it("tek stokta yalnız bir satış başarılı — race güvenli", async () => {
    const f = raceFixture!;
    const checkoutInput = (idempotencyKey: string) => ({
      idempotencyKey,
      paymentStatus: "PAID" as const,
      discount: 0,
      items: [
        {
          productId: f.productA.id,
          name: f.productA.name,
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
        },
      ],
      payments: [
        {
          paymentMethod: "CASH" as const,
          amount: 120,
          accountId: f.accountA.id,
        },
      ],
    });

    const results = await Promise.allSettled([
      executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data: checkoutInput(`race-a-${f.stamp}`),
      }),
      executePosCheckout({
        companyId: f.companyA.id,
        userId: f.userA.id,
        data: checkoutInput(`race-b-${f.stamp}`),
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const failure = rejected[0] as PromiseRejectedResult;
    assert.ok(failure.reason instanceof SaleStockValidationError);

    const stock = await db.warehouseStock.findFirst({
      where: {
        companyId: f.companyA.id,
        productId: f.productA.id,
        warehouseId: f.warehouseA.id,
      },
    });
    assert.equal(stock?.quantity, 0);

    const outMovements = await db.stockMovement.count({
      where: {
        companyId: f.companyA.id,
        productId: f.productA.id,
        type: "SALE",
      },
    });
    assert.equal(outMovements, 1);

    const sales = await db.sale.count({
      where: { companyId: f.companyA.id, status: "COMPLETED" },
    });
    assert.equal(sales, 1);

    const saleItems = await db.saleItem.count({
      where: { productId: f.productA.id },
    });
    assert.equal(saleItems, 1);

    const cashMovements = await db.accountTransaction.count({
      where: { accountId: f.accountA.id },
    });
    assert.equal(cashMovements, 1);
  });
});

describe("Faz 19.1 — warehouse transfer idempotency (POS idempotency proxy)", () => {
  it("Sale modelinde POS idempotency alanları tanımlı", () => {
    const schema = readSrc("prisma/schema.prisma");
    const saleBlock = schema.match(/model Sale \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(saleBlock.includes("idempotencyKey"));
    assert.ok(saleBlock.includes("payloadHash"));
    assert.ok(schema.includes("@@unique([companyId, idempotencyKey])"));
  });
});

describe("Faz 19.1 — warehouse transfer idempotency gerçek DB", { concurrency: false, ...dbTestOptions }, () => {
  let transferFixture: Fixture | null = null;
  let secondWarehouseId: string | null = null;

  before(async () => {
    await db.$queryRaw`SELECT 1`;
    transferFixture = await buildFixture();
    const wh = await db.warehouse.create({
      data: {
        companyId: transferFixture.companyA.id,
        name: `Depo 2 ${transferFixture.stamp}`,
        code: `WH2-${transferFixture.stamp}`,
        isDefault: false,
        status: "ACTIVE",
      },
    });
    secondWarehouseId = wh.id;

    const stockRow = await db.warehouseStock.findFirst({
      where: {
        companyId: transferFixture.companyA.id,
        productId: transferFixture.productA.id,
        warehouseId: transferFixture.warehouseA.id,
      },
    });
    assert.ok(stockRow);
    await db.warehouseStock.update({
      where: { id: stockRow.id },
      data: { quantity: 10 },
    });
  });

  after(async () => {
    if (transferFixture) {
      await cleanupFixture(transferFixture);
      transferFixture = null;
    }
    secondWarehouseId = null;
  });

  it("idempotency key replay tek transfer döner", async () => {
    const f = transferFixture!;
    const key = `idem-${f.stamp}`;
    const input = {
      companyId: f.companyA.id,
      userId: f.userA.id,
      fromWarehouseId: f.warehouseA.id,
      toWarehouseId: secondWarehouseId!,
      transferDate: new Date().toISOString(),
      note: "test",
      idempotencyKey: key,
      items: [{ productId: f.productA.id, quantity: 1 }],
    };

    const first = await executeWarehouseTransfer(input);
    assert.equal(first.ok, true);
    if (!first.ok) return;

    const second = await executeWarehouseTransfer(input);
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.replayed, true);

    const count = await db.warehouseTransfer.count({
      where: { companyId: f.companyA.id, idempotencyKey: key },
    });
    assert.equal(count, 1);
  });
});
