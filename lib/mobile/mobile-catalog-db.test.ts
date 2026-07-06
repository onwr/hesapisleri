/**
 * Mobile catalog archive + tenant isolation DB entegrasyon testleri.
 * TEST_DATABASE_URL gerekir.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { MobileCatalogError } from "./mobile-catalog-errors";

// Yalnız TEST_DATABASE_URL kontrol edilir — DATABASE_URL .env'de her zaman
// tanımlı olabilir (ör. localhost:5432) ama sandbox'ta erişilemez olabilir;
// DATABASE_URL'e fallback etmek testi "available" sayıp gerçek bağlantı
// hatasıyla suite'i cancel ettiriyordu.
const DB_AVAILABLE = !!process.env.TEST_DATABASE_URL;
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: mobile catalog DB tests require TEST_DATABASE_URL";

describe("mobile catalog DB", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let ownerAId: string;
  let posStaffId: string;
  let productAId: string;
  let productBId: string;
  let customerAId: string;
  let customerBId: string;
  let warehouseAId: string;
  let warehouseBId: string;
  let saleBId: string;

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
    await db.$connect();

    const { hashPassword } = await import("@/lib/auth");
    const hash = await hashPassword("TestPass123!");

    const ownerA = await db.user.create({
      data: {
        email: `catalog-owner-a-${Date.now()}@mobile-test.internal`,
        password: hash,
        name: "Catalog Owner A",
        role: "OWNER",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    ownerAId = ownerA.id;

    const posStaff = await db.user.create({
      data: {
        email: `catalog-pos-${Date.now()}@mobile-test.internal`,
        password: hash,
        name: "POS Staff",
        role: "POS_STAFF",
        status: "ACTIVE",
        sessionVersion: 1,
        loginTrackingStatus: "NEVER_LOGGED_IN",
      },
    });
    posStaffId = posStaff.id;

    const companyA = await db.company.create({
      data: { name: `TestMobile_CatalogA_${Date.now()}`, status: "ACTIVE" },
    });
    companyAId = companyA.id;

    const companyB = await db.company.create({
      data: { name: `TestMobile_CatalogB_${Date.now()}`, status: "ACTIVE" },
    });
    companyBId = companyB.id;

    await db.companyUser.createMany({
      data: [
        { userId: ownerAId, companyId: companyAId, role: "OWNER", status: "ACTIVE", isOwner: true },
        { userId: posStaffId, companyId: companyAId, role: "POS_STAFF", status: "ACTIVE", isOwner: false },
      ],
    });

    const catA = await db.productCategory.create({
      data: { companyId: companyAId, name: `CatA_${Date.now()}` },
    });
    const catB = await db.productCategory.create({
      data: { companyId: companyBId, name: `CatB_${Date.now()}` },
    });

    const productA = await db.product.create({
      data: {
        companyId: companyAId,
        categoryId: catA.id,
        name: "Catalog Product A",
        sku: `SKU-A-${Date.now()}`,
        productType: "STOCK",
        sellPrice: 100,
        stock: 5,
        status: "ACTIVE",
      },
    });
    productAId = productA.id;

    const productB = await db.product.create({
      data: {
        companyId: companyBId,
        categoryId: catB.id,
        name: "Catalog Product B",
        sku: `SKU-B-${Date.now()}`,
        productType: "STOCK",
        sellPrice: 50,
        stock: 3,
        status: "ACTIVE",
      },
    });
    productBId = productB.id;

    const customerA = await db.customer.create({
      data: { companyId: companyAId, name: "Customer A", status: "ACTIVE" },
    });
    customerAId = customerA.id;

    const customerB = await db.customer.create({
      data: { companyId: companyBId, name: "Customer B", status: "ACTIVE" },
    });
    customerBId = customerB.id;

    const warehouseA = await db.warehouse.create({
      data: { companyId: companyAId, name: `WH-A-${Date.now()}`, isDefault: true, status: "ACTIVE" },
    });
    warehouseAId = warehouseA.id;

    const warehouseB = await db.warehouse.create({
      data: { companyId: companyBId, name: `WH-B-${Date.now()}`, isDefault: true, status: "ACTIVE" },
    });
    warehouseBId = warehouseB.id;

    await db.warehouseStock.create({
      data: { companyId: companyAId, warehouseId: warehouseAId, productId: productAId, quantity: 5 },
    });
    await db.warehouseStock.create({
      data: { companyId: companyBId, warehouseId: warehouseBId, productId: productBId, quantity: 3 },
    });

    const saleB = await db.sale.create({
      data: {
        companyId: companyBId,
        customerId: customerBId,
        userId: ownerAId,
        saleNo: `CAT-B-${Date.now()}`,
        subtotal: 50,
        vatTotal: 10,
        total: 60,
        paymentStatus: "PAID",
        paidAmount: 60,
      },
    });
    saleBId = saleB.id;
  });

  after(async () => {
    if (!db) return;
    await db.sale.deleteMany({ where: { id: saleBId } });
    await db.warehouseStock.deleteMany({
      where: { companyId: { in: [companyAId, companyBId] } },
    });
    await db.warehouse.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.product.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.productCategory.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.customer.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.companyUser.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
    await db.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
    await db.user.deleteMany({
      where: { id: { in: [ownerAId, posStaffId] } },
    });
    await db.$disconnect();
  });

  it("current company ürünü archive edilir", async () => {
    const { archiveMobileProduct } = await import("./mobile-products-service");
    const result = await archiveMobileProduct({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      productId: productAId,
    });
    assert.equal(result.product.status, "PASSIVE");
  });

  it("ürün archive toggle ile restore edilir", async () => {
    const { archiveMobileProduct } = await import("./mobile-products-service");
    const result = await archiveMobileProduct({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      productId: productAId,
    });
    assert.equal(result.product.status, "ACTIVE");
  });

  it("foreign company ürünü archive edilemez", async () => {
    const { archiveMobileProduct } = await import("./mobile-products-service");
    await assert.rejects(
      () =>
        archiveMobileProduct({
          companyId: companyAId,
          userId: ownerAId,
          role: "OWNER",
          isOwner: true,
          productId: productBId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "PRODUCT_NOT_FOUND");
        return true;
      }
    );
  });

  it("yetkisiz rol ürün archive edemez", async () => {
    const { archiveMobileProduct } = await import("./mobile-products-service");
    await assert.rejects(
      () =>
        archiveMobileProduct({
          companyId: companyAId,
          userId: posStaffId,
          role: "POS_STAFF",
          isOwner: false,
          productId: productAId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  it("archive sonrası list/detail status doğru", async () => {
    const { archiveMobileProduct, listMobileProducts, getMobileProductById } = await import(
      "./mobile-products-service"
    );
    await archiveMobileProduct({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      productId: productAId,
    });
    const list = await listMobileProducts({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
    });
    const item = list.items.find((p) => p.id === productAId);
    assert.ok(item);
    assert.equal(item!.status, "PASSIVE");

    const detail = await getMobileProductById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      productId: productAId,
    });
    assert.equal(detail.product.status, "PASSIVE");

    await archiveMobileProduct({
      companyId: companyAId,
      userId: ownerAId,
      role: "OWNER",
      isOwner: true,
      productId: productAId,
    });
  });

  it("foreign product detail 404", async () => {
    const { getMobileProductById } = await import("./mobile-products-service");
    await assert.rejects(
      () =>
        getMobileProductById({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          productId: productBId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "PRODUCT_NOT_FOUND");
        return true;
      }
    );
  });

  it("current company müşterisi archive edilir", async () => {
    const { archiveMobileCustomer } = await import("./mobile-customers-service");
    const result = await archiveMobileCustomer({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
    assert.equal(result.customer.status, "PASSIVE");
  });

  it("müşteri archive toggle ile restore edilir", async () => {
    const { archiveMobileCustomer } = await import("./mobile-customers-service");
    const result = await archiveMobileCustomer({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
    assert.equal(result.customer.status, "ACTIVE");
  });

  it("foreign company müşterisi archive edilemez", async () => {
    const { archiveMobileCustomer } = await import("./mobile-customers-service");
    await assert.rejects(
      () =>
        archiveMobileCustomer({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          customerId: customerBId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "CUSTOMER_NOT_FOUND");
        return true;
      }
    );
  });

  it("yetkisiz rol müşteri archive edemez", async () => {
    const { archiveMobileCustomer } = await import("./mobile-customers-service");
    await assert.rejects(
      () =>
        archiveMobileCustomer({
          companyId: companyAId,
          role: "POS_STAFF",
          isOwner: false,
          customerId: customerAId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  it("archive sonrası müşteri list/detail PASSIVE", async () => {
    const { archiveMobileCustomer, listMobileCustomers, getMobileCustomerById } = await import(
      "./mobile-customers-service"
    );
    await archiveMobileCustomer({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
    const list = await listMobileCustomers({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
    });
    const item = list.items.find((c) => c.id === customerAId);
    assert.ok(item);
    assert.equal(item!.status, "PASSIVE");

    const detail = await getMobileCustomerById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
    assert.equal(detail.customer.status, "PASSIVE");

    await archiveMobileCustomer({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
  });

  it("foreign customer detail 404", async () => {
    const { getMobileCustomerById } = await import("./mobile-customers-service");
    await assert.rejects(
      () =>
        getMobileCustomerById({
          companyId: companyAId,
          role: "OWNER",
          isOwner: true,
          customerId: customerBId,
        }),
      (err: unknown) => {
        assert.ok(err instanceof MobileCatalogError);
        assert.equal(err.code, "CUSTOMER_NOT_FOUND");
        return true;
      }
    );
  });

  it("başka firmanın warehouse stock verisi görünmez", async () => {
    const { listMobileStocks } = await import("./mobile-stocks-service");
    const stocks = await listMobileStocks({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      warehouseId: warehouseBId,
    });
    assert.equal(stocks.items.length, 0);

    const all = await listMobileStocks({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
    });
    assert.ok(!all.items.some((row) => row.product.id === productBId));
  });

  it("ledger yalnız current company müşterisine ait", async () => {
    const { getMobileCustomerById } = await import("./mobile-customers-service");
    const detailA = await getMobileCustomerById({
      companyId: companyAId,
      role: "OWNER",
      isOwner: true,
      customerId: customerAId,
    });
    const recentSalesA = detailA.customer.recentSales ?? [];
    assert.equal(recentSalesA.length, 0);

    const detailB = await getMobileCustomerById({
      companyId: companyBId,
      role: "OWNER",
      isOwner: true,
      customerId: customerBId,
    });
    const recentSalesB = detailB.customer.recentSales ?? [];
    assert.ok(recentSalesB.some((s) => s.id === saleBId));
    assert.ok(!recentSalesA.some((s) => s.id === saleBId));
  });
});
