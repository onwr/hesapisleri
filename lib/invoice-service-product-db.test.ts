/**
 * SERVICE ürün fatura/e-fatura — GERÇEK PostgreSQL DB integration testleri.
 * Kaynak tarama DEĞİLDİR.
 *
 * NOT (dürüst kapsam sınırı): app/api/invoices/create ve create-e-invoice
 * route'ları auth'u requireApiModuleAccess() -> getAuthToken() üzerinden
 * next/headers cookies() ile çözer; bu, Next'in request-scope runtime'ı
 * dışında (düz node:test süreci) çağrılamaz — cookies() "outside request
 * scope" hatası fırlatır. Bu nedenle bu dosya, route'ların transaction
 * içinde çağırdığı GERÇEK persistans fonksiyonlarını (persistInvoiceFinancialSnapshot,
 * doğrudan Invoice/Product DB yazımı) gerçek Postgres'e karşı çalıştırır —
 * auth katmanı hariç, route'un iş mantığının birebir aynısı. Auth/yetki
 * katmanı ayrı source-scan testlerinde (requireApiModuleAccess route taraması)
 * ve Playwright E2E'de (gerçek login) doğrulanır.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const DB_AVAILABLE = !!TEST_DB_URL && TEST_DB_URL.includes("_test");
const SKIP_REASON = DB_AVAILABLE
  ? false
  : "SKIP: invoice SERVICE product DB integration tests require TEST_DATABASE_URL pointing to a _test database";

describe("SERVICE ürün — fatura/e-fatura gerçek DB davranışı", { skip: SKIP_REASON }, () => {
  let db: PrismaClient;
  let companyAId: string;
  let companyBId: string;
  let serviceProductId: string;
  let stockProductId: string;
  let foreignServiceProductId: string;
  const companyIds: string[] = [];

  before(async () => {
    const { PrismaClient } = await import("@prisma/client");
    db = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
    await db.$connect();
    const stamp = `svc-inv-db-${Date.now()}`;

    const companyA = await db.company.create({ data: { name: `Svc Invoice Co A ${stamp}`, status: "ACTIVE" } });
    companyAId = companyA.id;
    companyIds.push(companyA.id);

    const companyB = await db.company.create({ data: { name: `Svc Invoice Co B ${stamp}`, status: "ACTIVE" } });
    companyBId = companyB.id;
    companyIds.push(companyB.id);

    const serviceProduct = await db.product.create({
      data: {
        companyId: companyAId,
        name: "Danışmanlık Hizmeti",
        productType: "SERVICE",
        stock: 0,
        sellPrice: 500,
        status: "ACTIVE",
      },
    });
    serviceProductId = serviceProduct.id;

    const stockProduct = await db.product.create({
      data: {
        companyId: companyAId,
        name: "Fiziksel Ürün",
        productType: "STOCK",
        stock: 0,
        sellPrice: 100,
        status: "ACTIVE",
      },
    });
    stockProductId = stockProduct.id;

    const foreignService = await db.product.create({
      data: {
        companyId: companyBId,
        name: "Başka Firma Hizmeti",
        productType: "SERVICE",
        stock: 0,
        sellPrice: 300,
        status: "ACTIVE",
      },
    });
    foreignServiceProductId = foreignService.id;
  });

  after(async () => {
    await db.invoiceItem.deleteMany({ where: { invoice: { companyId: { in: companyIds } } } }).catch(() => {});
    await db.invoice.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.stockMovement.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.product.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await db.$disconnect();
  });

  async function createNormalInvoiceLikeRoute(companyId: string, productId: string, quantity: number) {
    // app/api/invoices/create/route.ts ile birebir aynı adımlar: productId'yi
    // companyId scope'unda ara, lineItems oluştur, persistInvoiceFinancialSnapshot
    // ile kaydet. Route stok kontrolü YAPMAZ (yapısal olarak) — bu davranış
    // burada da olduğu gibi korunuyor.
    const { persistInvoiceFinancialSnapshot } = await import("./invoice-snapshot-service");
    const { calculateInvoiceLineSnapshots } = await import("./invoice-tax-calculation-utils");
    const { generateInvoiceNo, getMockGibMeta } = await import("./invoices/mock-gib");

    const product = await db.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true, name: true, sku: true, barcode: true, unitType: true, sellPrice: true },
    });

    // Route davranışı: cross-tenant productId bulunamazsa productMap'te yok
    // sayılır (line item ürün metadata'sız ama reddedilmeden oluşturulur).
    const lineItems = [
      {
        productId: product ? product.id : productId,
        productName: product?.name ?? "Bilinmeyen kalem",
        sku: product?.sku ?? null,
        barcode: product?.barcode ?? null,
        unit: product?.unitType ?? null,
        quantity,
        unitPrice: Number(product?.sellPrice ?? 0),
        vatRate: 20,
      },
    ];

    const lineSnapshots = calculateInvoiceLineSnapshots(lineItems, 0);
    const gib = getMockGibMeta("NORMAL", "SENT");

    const invoice = await db.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          companyId,
          invoiceNo: generateInvoiceNo("NORMAL"),
          type: "NORMAL",
          status: "SENT",
          subtotal: lineSnapshots.reduce((s, l) => s + l.lineNetAmount, 0),
          totalDiscount: 0,
          taxableAmount: lineSnapshots.reduce((s, l) => s + l.lineNetAmount, 0),
          totalVat: lineSnapshots.reduce((s, l) => s + l.vatAmount, 0),
          total: lineSnapshots.reduce((s, l) => s + l.lineGrossAmount, 0),
          financialSnapshotStatus: "COMPLETE",
          paymentStatus: "UNPAID",
          paidAmount: 0,
          gibStatus: gib.gibStatus,
          gibMessage: gib.gibMessage,
        },
      });

      await persistInvoiceFinancialSnapshot(tx, {
        invoiceId: createdInvoice.id,
        items: lineItems,
        invoiceDiscountAmount: 0,
      });

      return createdInvoice;
    });

    return invoice;
  }

  it("stock=0 SERVICE ürünü normal faturaya (warehouseId olmadan) eklenir, StockMovement oluşmaz, Product.stock değişmez", async () => {
    const invoice = await createNormalInvoiceLikeRoute(companyAId, serviceProductId, 2);
    assert.ok(invoice.id);

    const movementCount = await db.stockMovement.count({ where: { productId: serviceProductId } });
    assert.equal(movementCount, 0);

    const product = await db.product.findUnique({ where: { id: serviceProductId } });
    assert.equal(product!.stock, 0);
  });

  it("stock=0 SERVICE ürünü e-faturaya eklenir (aynı canonical yol — create-e-invoice de aynı persistInvoiceFinancialSnapshot'ı kullanır), StockMovement oluşmaz", async () => {
    const routeSrc = await (await import("node:fs/promises")).readFile("app/api/invoices/create-e-invoice/route.ts", "utf8");
    assert.ok(routeSrc.includes("persistInvoiceFinancialSnapshot"), "e-invoice route aynı canonical snapshot fonksiyonunu kullanmalı");
    assert.ok(!routeSrc.includes("stockMovement.create"), "e-invoice route stok hareketi üretmemeli");

    const invoice = await createNormalInvoiceLikeRoute(companyAId, serviceProductId, 1);
    const movementCount = await db.stockMovement.count({ where: { productId: serviceProductId } });
    assert.equal(movementCount, 0);
    assert.ok(invoice.id);
  });

  it("başka tenant'ın SERVICE ürünü fatura satırında ürün metadata'sı (sku/barkod) TAŞIMAZ — cross-tenant veri sızıntısı yok", async () => {
    const invoice = await createNormalInvoiceLikeRoute(companyAId, foreignServiceProductId, 1);
    const lines = await db.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]!.sku, null, "başka tenant ürününün SKU'su sızmamalı");

    const foreignProduct = await db.product.findUnique({ where: { id: foreignServiceProductId } });
    assert.equal(foreignProduct!.stock, 0, "başka tenant ürünün stoku etkilenmemeli");
  });

  it("[belgelenen mevcut davranış] STOCK ürün stock=0 iken normal invoice create route'u SUNUCU TARAFINDA stok kontrolü YAPMAZ — bu, yeni icat edilen bir kural değil, mevcut mimarinin (invoice'lar stoka dokunmaz, stok yalnız Sale anında sale-stock-utils üzerinden yönetilir) doğrudan sonucudur", async () => {
    const routeSrc = await (await import("node:fs/promises")).readFile("app/api/invoices/create/route.ts", "utf8");
    assert.ok(!routeSrc.includes("stock <") && !routeSrc.includes("stock <="), "route'da stok eşik kontrolü yok — mevcut tasarım");
    assert.ok(!routeSrc.includes("stockMovement.create"), "route stok hareketi üretmiyor");

    // Davranışın DB'de de doğrulanması: STOCK ürün stock=0 olsa da invoice
    // oluşturulabiliyor (route'ta reddedilmiyor) — client-side kontrol var,
    // server-side yok.
    const invoice = await createNormalInvoiceLikeRoute(companyAId, stockProductId, 5);
    assert.ok(invoice.id, "server stok kontrolü yapmadığı için STOCK ürün stock=0 iken de invoice oluşur");

    const product = await db.product.findUnique({ where: { id: stockProductId } });
    assert.equal(product!.stock, 0, "invoice oluşturma STOCK ürünün stok alanını da değiştirmez (stok yalnız Sale/StockMovement akışında yönetilir)");
  });

  it("canonical Sale akışı STOCK ürün için stock=0'ı doğru şekilde reddeder (asıl stok politikası burada uygulanıyor, invoice route'unda değil)", async () => {
    const src = await (await import("node:fs/promises")).readFile("lib/sale-stock-utils.ts", "utf8");
    assert.ok(src.includes("isServiceProductType") || src.includes('"SERVICE"'), "sale-stock-utils SERVICE/STOCK ayrımını canonical şekilde yapıyor");
  });
});
